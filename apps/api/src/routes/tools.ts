import { Hono } from "hono";
import type { AuthVariables } from "../middleware/auth.js";
import { createGenerationJob } from "../lib/jobs.js";
import {
  getTool,
  listToolsPublic,
  parseToolRunBody,
} from "../lib/tools.js";
import { suggestModel } from "../lib/router.js";
import {
  enrichPromptWithReferences,
  resolveReferenceUrls,
} from "../lib/references.js";
import { AppError } from "../lib/errors.js";
import { recordAnalyticsEvent } from "../lib/analytics.js";
import { db } from "../db/index.js";

const tools = new Hono<{ Variables: AuthVariables }>();

tools.get("/list", (c) => c.json({ data: listToolsPublic() }));

tools.post("/:toolId/run", async (c) => {
  const userId = c.get("userId");
  const toolId = c.req.param("toolId");
  const tool = getTool(toolId);
  if (!tool) throw new AppError(404, "NOT_FOUND", "工具不存在");

  if (tool.clientOnly) {
    throw new AppError(
      400,
      "CLIENT_ONLY_TOOL",
      "该工具仅在画布客户端使用，无需调用服务端",
    );
  }

  const body = parseToolRunBody(await c.req.json());

  if (tool.requiresSource) {
    const hasRef =
      (body.referenceOutputIds?.length ?? 0) > 0 ||
      (body.assetIds?.length ?? 0) > 0;
    if (!hasRef) {
      throw new AppError(
        400,
        "SOURCE_REQUIRED",
        "请先在画布选择图片或上传参考图",
      );
    }
  }

  if (body.assetIds?.length) {
    for (const assetId of body.assetIds) {
      const asset = db
        .prepare(
          "SELECT id, url FROM assets WHERE id = ? AND user_id = ?",
        )
        .get(assetId, userId) as { id: string; url: string } | undefined;
      if (!asset) {
        throw new AppError(400, "INVALID_ASSET", "附件不存在");
      }
      if (asset.url.startsWith("pending:")) {
        throw new AppError(400, "INVALID_ASSET", "附件尚未完成上传");
      }
    }
  }

  let prompt = body.prompt?.trim() || tool.defaultPrompt;
  if (tool.id === "upscale" && body.scale) {
    prompt = `${prompt}（${body.scale} 放大）`;
  }

  const refUrls = body.referenceOutputIds
    ? resolveReferenceUrls(body.referenceOutputIds)
    : [];
  const assetUrls: string[] = [];
  if (body.assetIds?.length) {
    for (const assetId of body.assetIds) {
      const asset = db
        .prepare("SELECT url FROM assets WHERE id = ? AND user_id = ?")
        .get(assetId, userId) as { url: string } | undefined;
      if (asset) assetUrls.push(asset.url);
    }
  }
  prompt = enrichPromptWithReferences(prompt, [...refUrls, ...assetUrls]);

  const route = suggestModel("chat", prompt);
  const modelId = body.modelId ?? route.modelId;
  const { jobId, pointsCost } = createGenerationJob({
    sessionId: body.sessionId,
    userId,
    prompt: `【${tool.name}】${prompt}`,
    modelId,
    mode: "chat",
    count: 1,
    resolution: body.resolution,
    toolType: toolId,
  });

  void recordAnalyticsEvent(userId, "tool.run", {
    tool_id: toolId,
    job_id: jobId,
    category: tool.category,
  });

  return c.json({
    data: {
      jobId,
      estimatedPoints: pointsCost,
      tool: tool.name,
      toolId: tool.id,
      routeReason: route.reason,
    },
  });
});

export { tools };
