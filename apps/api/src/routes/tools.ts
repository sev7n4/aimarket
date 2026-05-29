import { Hono } from "hono";
import type { AuthVariables } from "../middleware/auth.js";
import { createGenerationJob } from "../lib/jobs.js";
import {
  getTool,
  listToolsPublic,
  parseToolRunBody,
} from "../lib/tools.js";
import { buildFocusEditPrompt } from "../lib/focus.js";
import { suggestModel } from "../lib/router.js";
import {
  enrichPromptWithReferences,
  resolveReferenceUrls,
} from "../lib/references.js";
import { toPublicAssetUrl } from "../lib/public-url.js";
import { AppError } from "../lib/errors.js";
import { recordAnalyticsEvent } from "../lib/analytics.js";
import { db } from "../db/index.js";
import { resolveJobLineage } from "../lib/job-lineage.js";

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

  if (tool.id === "focus-edit" && !body.focusPoints?.length) {
    throw new AppError(
      400,
      "FOCUS_REQUIRED",
      "请先在画布添加焦点标记（调用 POST /focus/point）",
    );
  }

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

  if (tool.id === "focus-edit" && body.focusPoints?.length) {
    prompt = buildFocusEditPrompt(
      prompt,
      body.focusPoints,
      body.intent ?? "edit",
    );
    const coordHints = body.focusPoints
      .map((p, i) => {
        const name = p.objectName.trim() || `焦点${i + 1}`;
        if (p.x == null || p.y == null) return name;
        return `${name}（约 x=${Math.round(p.x * 100)}%, y=${Math.round(p.y * 100)}%）`;
      })
      .join("、");
    if (coordHints) {
      prompt = `${prompt}\n【焦点位置】${coordHints}`;
    }
  }

  if (body.toolContext?.masks.length) {
    const maskHints = body.toolContext.masks
      .map((m, i) => {
        const pct = {
          x: Math.round(m.normalizedBbox.x * 100),
          y: Math.round(m.normalizedBbox.y * 100),
          w: Math.round(m.normalizedBbox.width * 100),
          h: Math.round(m.normalizedBbox.height * 100),
        };
        return `区域${i + 1}: ${m.mode === "brush" ? "手指/画笔圈选" : "矩形框选"}，大致位于 x=${pct.x}%, y=${pct.y}%, w=${pct.w}%, h=${pct.h}%`;
      })
      .join("；");
    prompt = `${prompt}\n【局部编辑区域】${maskHints}`;
  }
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
      if (asset) assetUrls.push(toPublicAssetUrl(asset.url));
    }
  }
  prompt = enrichPromptWithReferences(prompt, [...refUrls, ...assetUrls]);

  const route = suggestModel("chat", prompt);
  const modelId = body.modelId ?? route.modelId;
  const lineage = resolveJobLineage({
    referenceOutputIds: body.referenceOutputIds,
  });
  const { jobId, pointsCost } = createGenerationJob({
    sessionId: body.sessionId,
    userId,
    prompt: `【${tool.name}】${prompt}`,
    modelId,
    mode: "chat",
    count: body.count,
    resolution: body.resolution,
    aspectRatio: body.aspectRatio,
    toolType: toolId,
    toolContext: body.toolContext,
    parentJobId: lineage.parentJobId,
    sourceOutputId: lineage.sourceOutputId,
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
