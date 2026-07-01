import { Hono } from "hono";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { AuthVariables } from "../middleware/auth.js";
import { ALL_MODELS, getModel, VIDEO_MODEL_IDS } from "../lib/models.js";
import {
  getProviderStatus,
  generateImages,
  editImage,
  variationImage,
} from "../providers/registry.js";
import { getPromptOptimizeStatus } from "../lib/prompt-optimize.js";
import { getToolProviderStatus } from "../providers/tools/registry.js";
import { getFocusPointProviderStatus } from "../lib/focus-point.js";
import { getModerationStatus } from "../lib/moderation/index.js";
import { streamSSE } from "hono/streaming";
import { estimatePoints } from "../lib/pricing.js";
import { createGenerationJob, getJob } from "../lib/jobs.js";
import { suggestModel } from "../lib/router.js";
import { userHasByokOpenAi } from "../lib/user-provider-config.js";
import {
  buildReferenceAwarePrompt,
  resolveReferenceUrls,
} from "../lib/references.js";
import {
  coerceVideoAspectRatio,
  coerceVideoResolution,
} from "../lib/video-output-presets.js";
import {
  applyVideoReferenceMode,
  buildVideoReferencePrompt,
  buildSmartMultiFramePrompt,
  normalizeVideoReferenceMode,
  resolveAssetMediaRefs,
  resolveAssetReferenceUrls,
  resolveEffectiveDurationSec,
  resolveSmartMultiShots,
  resolveStructuredVideoReferences,
  validateVideoReferencePayload,
} from "../lib/video-references.js";
import { toPublicAssetUrl } from "../lib/public-url.js";
import { db } from "../db/index.js";
import { AppError } from "../lib/errors.js";
import { assertSessionWrite } from "../lib/session-access.js";
import { assertPromptAllowed } from "../lib/content-moderation.js";
import { rateLimit } from "../lib/rate-limit.js";
import { toolContextSchema } from "../lib/tools.js";
import {
  getVideoModelRoutes,
  getVideoProviderStatus,
  resolveDefaultVideoModelId,
  resolveVideoModelRoute,
} from "../providers/video/registry.js";
import { resolveJobLineage } from "../lib/job-lineage.js";

const ai = new Hono<{ Variables: AuthVariables }>();

ai.get("/queryModels", (c) => {
  const autoModelId = resolveDefaultVideoModelId();
  const autoRoute = resolveVideoModelRoute(autoModelId);
  return c.json({
    data: ALL_MODELS,
    meta: {
      videoAuto: {
        modelId: autoModelId,
        provider: autoRoute.provider,
        modelName: getModel(autoModelId)?.name ?? autoModelId,
        routingHint: autoRoute.routingHint,
        upstreamLabel: autoRoute.upstreamLabel,
      },
      videoRoutes: getVideoModelRoutes(),
    },
  });
});

ai.get("/providerStatus", (c) =>
  c.json({
    data: {
      ...getProviderStatus(),
      video: getVideoProviderStatus(),
      tools: getToolProviderStatus(),
      focusPoint: getFocusPointProviderStatus(),
      promptOptimize: getPromptOptimizeStatus(),
      moderation: getModerationStatus(),
    },
  }),
);

ai.post("/suggestModel", async (c) => {
  const body = z
    .object({
      mode: z.enum(["chat", "image", "ecommerce"]).default("image"),
      prompt: z.string().default(""),
      hasReferenceImages: z.boolean().optional(),
    })
    .parse(await c.req.json());

  const userId = c.get("userId");
  const suggestion = suggestModel(
    body.mode,
    body.prompt,
    body.hasReferenceImages,
    userId,
  );
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
      mode: z.enum(["chat", "image", "ecommerce"]).default("image"),
      operation: z.enum(["generate", "edit", "variation"]).default("generate"),
      image: z.string().optional(),
      mask: z.string().optional(),
      assetIds: z.array(z.string().uuid()).optional(),
      referenceOutputIds: z.array(z.string().uuid()).optional(),
      autoRoute: z.boolean().default(false),
      toolContext: toolContextSchema.optional(),
      parentJobId: z.string().uuid().optional(),
      sourceOutputId: z.string().uuid().optional(),
      sourceLane: z.enum(["agent", "image", "video"]).optional().default("image"),
    })
    .parse(await c.req.json());

  const modelMeta = getModel(body.modelId ?? "");
  if (modelMeta?.type === "video") {
    throw new AppError(400, "USE_VIDEO_ENDPOINT", "视频生成请使用 /ai/generate/video");
  }

  if (body.operation === "edit" || body.operation === "variation") {
    throw new AppError(
      410,
      "USE_TOOL_ENDPOINT",
      `图片${body.operation === "variation" ? "变体" : "编辑"}请使用 POST /api/v1/tools/${body.operation === "variation" ? "variation" : "inpaint"}/run（工具链）`,
    );
  }

  if (body.assetIds?.length) {
    for (const assetId of body.assetIds) {
      const asset = db
        .prepare("SELECT id FROM assets WHERE id = ? AND user_id = ?")
        .get(assetId, userId);
      if (!asset) throw new AppError(400, "INVALID_ASSET", "附件不存在");
    }
  }

  const route = suggestModel(
    body.mode,
    body.prompt,
    Boolean(body.assetIds?.length || body.referenceOutputIds?.length),
    userId,
  );
  const isAutoSubmit = body.autoRoute || !body.modelId;
  const modelId = isAutoSubmit ? route.modelId : body.modelId!;
  const routingMode = isAutoSubmit ? route.routingMode : "explicit";
  const qualityTier = isAutoSubmit ? route.qualityTier : undefined;

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

  const allReferenceUrls = [...refUrls, ...assetUrls];
  let prompt = body.prompt;
  if (allReferenceUrls.length > 0) {
    prompt = buildReferenceAwarePrompt(body.prompt, allReferenceUrls);
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
    referenceUrls: allReferenceUrls.length > 0 ? allReferenceUrls : undefined,
    sourceLane: body.sourceLane,
    autoRoute: routingMode === "auto",
    routingMode,
    qualityTier,
  });

  const byokActive = userHasByokOpenAi(userId);

  return c.json({
    data: {
      jobId,
      estimatedPoints: pointsCost,
      status: "queued",
      modelId,
      routingMode,
      qualityTier,
      aspectRatio: body.aspectRatio,
      routeReason:
        isAutoSubmit ? route.reason
        : byokActive ? "已启用 BYOK，将优先使用您的 OpenAI Key"
        : undefined,
      byokActive,
    },
  });
});

ai.get("/jobs/:jobId", (c) => {
  const userId = c.get("userId");
  const jobId = c.req.param("jobId");
  const job = getJob(jobId, userId);
  return c.json({ data: job });
});

ai.post("/jobs/:jobId/cancel", (c) => {
  const userId = c.get("userId");
  const jobId = c.req.param("jobId");
  
  const job = db
    .prepare(
      `SELECT id, session_id, user_id, status, points_cost FROM generation_jobs WHERE id = ?`,
    )
    .get(jobId) as {
    id: string;
    session_id: string;
    user_id: string;
    status: string;
    points_cost: number;
  } | undefined;

  if (!job) {
    throw new AppError(404, "NOT_FOUND", "任务不存在");
  }

  assertSessionWrite(userId, job.session_id);

  if (job.status !== "queued" && job.status !== "running") {
    throw new AppError(400, "INVALID_STATUS", "任务已完成或已取消，无法再次取消");
  }

  db.transaction(() => {
    db.prepare(
      `UPDATE generation_jobs SET status = 'cancelled', error = '用户取消任务', completed_at = datetime('now') WHERE id = ?`,
    ).run(jobId);
    
    db.prepare(
      "UPDATE users SET credits = credits + ? WHERE id = ?",
    ).run(job.points_cost, userId);
    
    db.prepare(
      `UPDATE image_sessions SET status = 'idle', updated_at = datetime('now') WHERE id = ?`,
    ).run(job.session_id);
    
    db.prepare(
      `INSERT INTO messages (id, session_id, role, content, job_id)
       VALUES (?, ?, 'assistant', ?, ?)`,
    ).run(
      randomUUID(),
      job.session_id,
      `任务已取消，积分已退回。`,
      jobId,
    );
  });

  return c.json({ data: { status: "cancelled", refundedPoints: job.points_cost } });
});

ai.post("/generate/video", async (c) => {
  const userId = c.get("userId");
  await rateLimit(`video:${userId}`, 20, 60_000);

  const videoMediaRefSchema = z.object({
    assetId: z.string().uuid(),
    mediaType: z.enum(["image", "audio", "video"]),
    role: z.enum(["reference", "first_frame", "last_frame"]).optional(),
  });

  const smartMultiShotSchema = z.object({
    order: z.number().int().min(0),
    assetId: z.string().uuid().optional(),
    motionPrompt: z.string().max(2000),
  });

  const bodyRaw = z
    .object({
      sessionId: z.string().uuid(),
      prompt: z.string().min(1).max(4000),
      modelId: z.enum(VIDEO_MODEL_IDS).default("seedance-2"),
      count: z.number().int().min(1).max(2).default(1),
      resolution: z.enum(["1k", "2k"]).default("1k"),
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
      parentJobId: z.string().uuid().optional(),
      sourceOutputId: z.string().uuid().optional(),
      referenceMode: z
        .enum(["omni", "first-frame", "first-last", "smart-multi-frame"])
        .default("omni"),
      durationSec: z
        .union([
          z.literal(4),
          z.literal(5),
          z.literal(6),
          z.literal(8),
          z.literal(10),
          z.literal(12),
          z.literal(15),
        ])
        .optional(),
      videoResolution: z.enum(["720P", "1080P"]).optional(),
      videoReferences: z.array(videoMediaRefSchema).max(12).optional(),
      smartMultiShots: z.array(smartMultiShotSchema).max(12).optional(),
      assetIds: z.array(z.string().uuid()).optional(),
      referenceOutputIds: z.array(z.string().uuid()).optional(),
    })
    .parse(await c.req.json());

  const referenceMode = normalizeVideoReferenceMode(bodyRaw.referenceMode);
  const body = { ...bodyRaw, referenceMode };

  const videoRoute = resolveVideoModelRoute(body.modelId);
  if (!videoRoute.available) {
    throw new AppError(
      503,
      "VIDEO_MODEL_UNAVAILABLE",
      videoRoute.unavailableReason ?? "该视频模型当前不可用",
    );
  }

  const allAssetIds = new Set<string>([
    ...(body.assetIds ?? []),
    ...(body.videoReferences?.map((r) => r.assetId) ?? []),
    ...(body.smartMultiShots?.flatMap((s) =>
      s.assetId ? [s.assetId] : [],
    ) ?? []),
  ]);
  for (const assetId of allAssetIds) {
    const asset = db
      .prepare("SELECT id FROM assets WHERE id = ? AND user_id = ?")
      .get(assetId, userId);
    if (!asset) throw new AppError(400, "INVALID_ASSET", "附件不存在");
  }

  const refUrls = body.referenceOutputIds
    ? resolveReferenceUrls(body.referenceOutputIds)
    : [];
  const legacyAssetUrls = body.assetIds?.length
    ? resolveAssetReferenceUrls(body.assetIds, userId)
    : [];

  const structuredRefs = body.videoReferences?.length
    ? resolveStructuredVideoReferences(body.videoReferences, userId)
    : body.assetIds?.length
      ? resolveAssetMediaRefs(body.assetIds, userId)
      : [];

  const resolvedShots = body.smartMultiShots?.length
    ? resolveSmartMultiShots(body.smartMultiShots, userId)
    : [];

  const mergedReferenceUrls = applyVideoReferenceMode(
    [...refUrls, ...legacyAssetUrls, ...structuredRefs.map((r) => r.url)],
    referenceMode,
  );

  const validation = validateVideoReferencePayload({
    mode: referenceMode,
    videoReferences: body.videoReferences,
    smartMultiShots: body.smartMultiShots,
    referenceUrls: mergedReferenceUrls,
  });
  if (!validation.ok) {
    throw new AppError(
      400,
      validation.code ?? "INVALID_VIDEO_REFERENCE",
      validation.message ?? "视频参考参数无效",
    );
  }

  const aspectRatio = coerceVideoAspectRatio(referenceMode, body.aspectRatio);
  const videoResolution = coerceVideoResolution(
    referenceMode,
    body.videoResolution,
  );
  const durationSec = resolveEffectiveDurationSec(
    referenceMode,
    body.durationSec,
    body.smartMultiShots?.length,
  );

  let prompt = body.prompt;
  if (referenceMode === "smart-multi-frame" && resolvedShots.length) {
    prompt = buildSmartMultiFramePrompt(body.prompt, resolvedShots);
  } else if (mergedReferenceUrls.length > 0) {
    prompt = buildVideoReferencePrompt(body.prompt, mergedReferenceUrls);
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
    modelId: body.modelId,
    mode: "chat",
    count: body.count,
    resolution: body.resolution,
    aspectRatio,
    toolType: "video",
    toolContext: {
      videoReferenceMode: referenceMode,
      durationSec,
      videoResolution,
      videoReferences: structuredRefs.length ? structuredRefs : undefined,
      smartMultiShots: body.smartMultiShots,
      referenceUrls: mergedReferenceUrls.length ? mergedReferenceUrls : undefined,
      validationHint: validation.message,
    },
    parentJobId: lineage.parentJobId,
    sourceOutputId: lineage.sourceOutputId,
    referenceUrls: mergedReferenceUrls.length ? mergedReferenceUrls : undefined,
    sourceLane: "video",
  });

  return c.json({
    data: { jobId, estimatedPoints: pointsCost, status: "queued" },
  });
});

ai.get("/jobs/:jobId/stream", (c) => {
  const userId = c.get("userId");
  const jobId = c.req.param("jobId");

  return streamSSE(c, async (stream) => {
    const pollMs = 800;
    const maxMs = Number(process.env.JOB_STREAM_MAX_MS ?? 900_000);
    const deadline = Date.now() + maxMs;
    let lastStatus = "";
    let lastOutputCount = -1;
    while (Date.now() < deadline) {
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
            queueAhead: job.queue_ahead ?? null,
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
      await stream.sleep(pollMs);
    }
  });
});

/** AI 音乐生成 */
ai.post("/music", async (c) => {
  const userId = c.get("userId");
  await rateLimit(`music:${userId}`, 10, 60_000);

  const body = z
    .object({
      sessionId: z.string().uuid(),
      style: z.string().min(1).max(500).default("轻快电子乐"),
      bpm: z.number().int().min(60).max(200).default(120),
      durationSec: z.number().int().min(10).max(120).default(30),
    })
    .parse(await c.req.json());

  const { jobId, pointsCost } = createGenerationJob({
    sessionId: body.sessionId,
    userId,
    prompt: `【AI 音乐生成】风格: ${body.style}, BPM: ${body.bpm}, 时长: ${body.durationSec}s`,
    modelId: "omni-v2",
    mode: "chat",
    count: 1,
    resolution: "1k",
    toolType: "music-gen",
    toolContext: {
      toolId: "music-gen",
      masks: [],
      style: body.style,
      bpm: body.bpm,
      durationSec: body.durationSec,
    } as Record<string, unknown>,
  });

  return c.json({
    data: { jobId, estimatedPoints: pointsCost, status: "queued" },
  });
});

export { ai };
