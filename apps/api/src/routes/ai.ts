import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../middleware/auth.js";
import { ALL_MODELS, getModel } from "../lib/models.js";
import { getProviderStatus } from "../providers/registry.js";
import { getPromptOptimizeStatus } from "../lib/prompt-optimize.js";
import { getToolProviderStatus } from "../providers/tools/registry.js";
import { getModerationStatus } from "../lib/moderation/index.js";
import { streamSSE } from "hono/streaming";
import { estimatePoints } from "../lib/pricing.js";
import { createGenerationJob, getJob } from "../lib/jobs.js";
import { suggestModel } from "../lib/router.js";
import {
  enrichPromptWithReferences,
  resolveReferenceUrls,
} from "../lib/references.js";
import { toPublicAssetUrl } from "../lib/public-url.js";
import { db } from "../db/index.js";
import { AppError } from "../lib/errors.js";
import { assertPromptAllowed } from "../lib/content-moderation.js";
import { rateLimit } from "../lib/rate-limit.js";
import { toolContextSchema } from "../lib/tools.js";
import { resolveJobLineage } from "../lib/job-lineage.js";

const ai = new Hono<{ Variables: AuthVariables }>();

ai.get("/queryModels", (c) => c.json({ data: ALL_MODELS }));

ai.get("/providerStatus", (c) =>
  c.json({
    data: {
      ...getProviderStatus(),
      tools: getToolProviderStatus(),
      promptOptimize: getPromptOptimizeStatus(),
      moderation: getModerationStatus(),
    },
  }),
);

ai.post("/suggestModel", async (c) => {
  const body = z
    .object({
      mode: z.enum(["chat", "quick", "ecommerce"]).default("chat"),
      prompt: z.string().default(""),
    })
    .parse(await c.req.json());

  const suggestion = suggestModel(body.mode, body.prompt);
  return c.json({ data: suggestion });
});

ai.post("/estimatePointsBatch", async (c) => {
  const body = z
    .object({
      items: z
        .array(
          z.object({
            modelId: z.string(),
            count: z.number().int().positive().default(1),
            resolution: z.string().default("1k"),
          }),
        )
        .min(1),
    })
    .parse(await c.req.json());

  const totalPoints = body.items.reduce(
    (sum, item) =>
      sum + estimatePoints(item.modelId, item.count, item.resolution),
    0,
  );

  return c.json({ data: { totalPoints, currency: "credits" } });
});

ai.post("/generate", async (c) => {
  const userId = c.get("userId");
  await rateLimit(`generate:${userId}`, 40, 60_000);
  const body = z
    .object({
      sessionId: z.string().uuid(),
      prompt: z.string().min(1).max(4000),
      modelId: z.string().optional(),
      count: z.number().int().min(1).max(4).default(1),
      resolution: z.enum(["1k", "2k", "4k"]).default("1k"),
      aspectRatio: z
        .enum([
          "auto",
          "1:1",
          "4:3",
          "3:4",
          "16:9",
          "9:16",
          "3:2",
          "2:3",
          "4:5",
          "5:4",
          "21:9",
        ])
        .default("auto"),
      mode: z.enum(["chat", "quick", "ecommerce"]).default("chat"),
      assetIds: z.array(z.string().uuid()).optional(),
      referenceOutputIds: z.array(z.string().uuid()).optional(),
      autoRoute: z.boolean().default(false),
      toolContext: toolContextSchema.optional(),
      parentJobId: z.string().uuid().optional(),
      sourceOutputId: z.string().uuid().optional(),
    })
    .parse(await c.req.json());

  const modelMeta = getModel(body.modelId ?? "");
  if (modelMeta?.type === "video") {
    throw new AppError(400, "USE_VIDEO_ENDPOINT", "视频生成请使用 /ai/generate/video");
  }

  if (body.assetIds?.length) {
    for (const assetId of body.assetIds) {
      const asset = db
        .prepare("SELECT id FROM assets WHERE id = ? AND user_id = ?")
        .get(assetId, userId);
      if (!asset) throw new AppError(400, "INVALID_ASSET", "附件不存在");
    }
  }

  const route = suggestModel(body.mode, body.prompt);
  const modelId =
    body.autoRoute || !body.modelId ? route.modelId : body.modelId;

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

  let prompt = enrichPromptWithReferences(body.prompt, [
    ...refUrls,
    ...assetUrls,
  ]);
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
  await assertPromptAllowed(prompt);

  const lineage = resolveJobLineage({
    parentJobId: body.parentJobId,
    sourceOutputId: body.sourceOutputId,
    referenceOutputIds: body.referenceOutputIds,
  });

  const { jobId, pointsCost } = createGenerationJob({
    sessionId: body.sessionId,
    userId,
    prompt,
    modelId,
    mode: body.mode,
    count: body.count,
    resolution: body.resolution,
    aspectRatio: body.aspectRatio,
    toolType: body.toolContext?.toolId,
    toolContext: body.toolContext,
    parentJobId: lineage.parentJobId,
    sourceOutputId: lineage.sourceOutputId,
  });

  return c.json({
    data: {
      jobId,
      estimatedPoints: pointsCost,
      status: "queued",
      modelId,
      aspectRatio: body.aspectRatio,
      routeReason: body.autoRoute ? route.reason : undefined,
    },
  });
});

ai.get("/jobs/:jobId", (c) => {
  const userId = c.get("userId");
  const jobId = c.req.param("jobId");
  const job = getJob(jobId, userId);
  return c.json({ data: job });
});

ai.post("/generate/video", async (c) => {
  const userId = c.get("userId");
  await rateLimit(`video:${userId}`, 20, 60_000);
  const body = z
    .object({
      sessionId: z.string().uuid(),
      prompt: z.string().min(1).max(4000),
      modelId: z.enum(["seedance-2", "wan-2.6"]).default("seedance-2"),
      count: z.number().int().min(1).max(2).default(1),
      resolution: z.enum(["1k", "2k"]).default("1k"),
      parentJobId: z.string().uuid().optional(),
      sourceOutputId: z.string().uuid().optional(),
    })
    .parse(await c.req.json());

  await assertPromptAllowed(body.prompt);

  const lineage = resolveJobLineage({
    parentJobId: body.parentJobId,
    sourceOutputId: body.sourceOutputId,
  });

  const { jobId, pointsCost } = createGenerationJob({
    sessionId: body.sessionId,
    userId,
    prompt: body.prompt,
    modelId: body.modelId,
    mode: "chat",
    count: body.count,
    resolution: body.resolution,
    toolType: "video",
    parentJobId: lineage.parentJobId,
    sourceOutputId: lineage.sourceOutputId,
  });

  return c.json({
    data: { jobId, estimatedPoints: pointsCost, status: "queued" },
  });
});

ai.get("/jobs/:jobId/stream", (c) => {
  const userId = c.get("userId");
  const jobId = c.req.param("jobId");

  return streamSSE(c, async (stream) => {
    let lastStatus = "";
    let lastOutputCount = -1;
    for (let i = 0; i < 120; i++) {
      const job = getJob(jobId, userId);
      const outputCount = job.outputs.length;
      if (job.status !== lastStatus || outputCount !== lastOutputCount) {
        lastStatus = job.status as string;
        lastOutputCount = outputCount;
        await stream.writeSSE({
          event: "status",
          data: JSON.stringify({
            status: job.status,
            error: job.error,
            outputs: job.outputs,
            outputType: job.outputType,
            count: job.count,
            completed: outputCount,
          }),
        });
      }
      if (job.status === "succeeded" || job.status === "failed") {
        await stream.writeSSE({
          event: "done",
          data: JSON.stringify({ status: job.status }),
        });
        break;
      }
      await stream.sleep(800);
    }
  });
});

export { ai };
