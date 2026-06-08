import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../middleware/auth.js";
import { expandExtendSchema } from "../lib/expand-extend.js";
import { mergeExpandToolContext } from "../lib/expand-run.js";
import { createGenerationJob } from "../lib/jobs.js";
import { resolveJobLineage } from "../lib/job-lineage.js";
import { enrichPromptWithReferences, resolveReferenceUrls } from "../lib/references.js";
import { toPublicAssetUrl } from "../lib/public-url.js";
import { AppError } from "../lib/errors.js";
import { getTool } from "../lib/tools.js";
import { ensureToolProviderHealthy } from "../lib/tool-preflight.js";
import {
  mockReversePrompt,
  resolveImageUrlForReverse,
} from "../lib/prompt-reverse.js";
import { db } from "../db/index.js";
import { recordAnalyticsEvent } from "../lib/analytics.js";

const image = new Hono<{ Variables: AuthVariables }>();

const reverseBodySchema = z.object({
  imageUrl: z.string().max(2048).optional(),
  assetId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
});

async function handlePromptReverse(
  c: { get: (k: "userId") => string },
  body: z.infer<typeof reverseBodySchema>,
) {
  const userId = c.get("userId");
  const imageUrl = resolveImageUrlForReverse({
    imageUrl: body.imageUrl,
    assetId: body.assetId,
    userId,
  });
  const prompt = mockReversePrompt(imageUrl);
  return {
    prompt,
    imageUrl,
    source: "mock" as const,
  };
}

/** Canonical：图生文（mock，P4 可换 LLM） */
image.post("/prompt-reverse", async (c) => {
  const body = reverseBodySchema.parse(await c.req.json());
  const data = await handlePromptReverse(c, body);
  return c.json({ data });
});

/** 椒图别名（与 canonical 同响应） */
image.post("/originalImagePromptReverse", async (c) => {
  const body = reverseBodySchema.parse(await c.req.json());
  const data = await handlePromptReverse(c, body);
  return c.json({ data });
});

image.post("/templateSummaryPromptReverse", async (c) => {
  const body = reverseBodySchema.parse(await c.req.json());
  const data = await handlePromptReverse(c, body);
  return c.json({ data });
});

const extendImageBodySchema = z.object({
  sessionId: z.string().uuid(),
  sourceOssId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  referenceOutputIds: z.array(z.string().uuid()).optional(),
  prompt: z.string().max(4000).optional(),
  extend: expandExtendSchema.optional(),
  resolution: z.enum(["1k", "2k", "4k"]).optional(),
});

async function handleExtendImage(
  c: { get: (k: "userId") => string },
  body: z.infer<typeof extendImageBodySchema>,
) {
  const userId = c.get("userId");
  const tool = getTool("expand");
  if (!tool) {
    throw new AppError(404, "NOT_FOUND", "扩图工具不可用");
  }

  const assetId = body.assetId ?? body.sourceOssId;
  if (!assetId && !(body.referenceOutputIds?.length ?? 0)) {
    throw new AppError(
      400,
      "SOURCE_REQUIRED",
      "请提供 sourceOssId、assetId 或 referenceOutputIds",
    );
  }

  if (assetId) {
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

  let prompt = body.prompt?.trim() || tool.defaultPrompt;
  const refUrls = body.referenceOutputIds
    ? resolveReferenceUrls(body.referenceOutputIds)
    : [];
  const assetUrls: string[] = [];
  if (assetId) {
    const asset = db
      .prepare("SELECT url FROM assets WHERE id = ? AND user_id = ?")
      .get(assetId, userId) as { url: string };
    assetUrls.push(toPublicAssetUrl(asset.url));
  }
  prompt = enrichPromptWithReferences(prompt, [...refUrls, ...assetUrls]);

  const toolContext = mergeExpandToolContext("expand", {
    extend: body.extend,
    toolContext: undefined,
  });

  const lineage = resolveJobLineage({
    referenceOutputIds: body.referenceOutputIds,
  });

  await ensureToolProviderHealthy("expand", userId);

  const { jobId, pointsCost } = createGenerationJob({
    sessionId: body.sessionId,
    userId,
    prompt: `【${tool.name}】${prompt}`,
    modelId: "omni-v2",
    mode: "chat",
    count: 1,
    resolution: body.resolution ?? "2k",
    aspectRatio: "auto",
    toolType: "expand",
    toolContext,
    parentJobId: lineage.parentJobId,
    sourceOutputId: lineage.sourceOutputId,
    referenceUrls: [...refUrls, ...assetUrls],
  });

  void recordAnalyticsEvent(userId, "tool.run", {
    tool_id: "expand",
    job_id: jobId,
    category: tool.category,
    via: "extendImage",
  });

  return {
    jobId,
    estimatedPoints: pointsCost,
    taskId: jobId,
    tool: tool.name,
    toolId: tool.id,
  };
}

/** 椒图 / 兼容：真扩图（万相 expand 或 TOOL_EXPAND_HTTP_URL） */
image.post("/extendImage", async (c) => {
  const body = extendImageBodySchema.parse(await c.req.json());
  const data = await handleExtendImage(c, body);
  return c.json({ data });
});

export { image };
