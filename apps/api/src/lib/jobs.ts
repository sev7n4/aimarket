import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { ECOMMERCE_SLIDES } from "./ecommerce.js";
import { estimatePoints, estimateToolPoints } from "./pricing.js";
import { getModel } from "./models.js";
import { getTool, type ToolContext } from "./tools.js";
import type { SmartMultiShot, VideoMediaRef } from "./video-references.js";
import { AppError } from "./errors.js";
import { assertSessionWrite, assertSessionRead } from "./session-access.js";
import { recordAnalyticsEvent } from "./analytics.js";
import { assertOutputsAllowed } from "./content-moderation.js";
import {
  generateImages,
  editImage,
  variationImage,
  resolveProvider,
} from "../providers/registry.js";
import {
  resolveToolProvider,
  runToolImages,
} from "../providers/tools/registry.js";
import {
  generateVideos,
  resolveVideoProvider,
} from "../providers/video/registry.js";
import { enqueueJob } from "./queue/index.js";
import type { JobQueuePayload } from "./queue/types.js";
import { notifyAgentJobCompleted } from "./agent/job-events.js";
import { assertEmailVerifiedForSpend } from "./email-verification.js";
import { ensureThumbnail, ensureThumbnails } from "./thumbnails.js";
import type {
  GenerationQualityTier,
  GenerationRoutingMode,
} from "./generation-routing.js";
import type { SourceLane } from "./source-lane.js";
import { inferSourceLane } from "./source-lane.js";
import { assertToolProviderReady } from "./tool-preflight.js";
import { recordProviderHealthFailure } from "./provider-health-cache.js";
import { reconcileStaleGenerationJob } from "./job-watchdog.js";
import { markGenerationJobFailed } from "./job-fail.js";

const delayMs = Number(process.env.MOCK_GENERATION_DELAY_MS ?? 2500);

/** 套图批量生成标记，走 slideLabels 多图分支，不是 Studio 工具链 */
export function isEcommerceSetToolType(toolType: string | null | undefined): boolean {
  return toolType === "ecommerce-set";
}

function formatToolProviderLabel(provider: string | undefined): string {
  if (!provider) return "";
  const labels: Record<string, string> = {
    "tool-seedream": "Seedream 工具链",
    "tool-wan-expand": "万相扩图",
    "tool-expand-http": "扩图 HTTP 网关",
    "tool-openai-variation": "OpenAI 变体",
    "tool-variation-mock": "Mock",
    "tool-openai-edit": "OpenAI 编辑",
  };
  return labels[provider] ?? provider;
}

export interface CreateJobInput {
  sessionId: string;
  userId: string;
  prompt: string;
  modelId: string;
  mode: string;
  count: number;
  resolution: string;
  aspectRatio?: string;
  toolType?: string;
  toolContext?: ToolContext | Record<string, unknown>;
  slideLabels?: string[];
  parentJobId?: string | null;
  sourceOutputId?: string | null;
  referenceUrls?: string[];
  /** 创作 Dock 车道溯源（agent / image / video） */
  sourceLane?: SourceLane | null;
  /** 创作台 Auto：写入 tool_context，供异步 job 跨 Provider 回落 */
  autoRoute?: boolean;
  routingMode?: GenerationRoutingMode;
  qualityTier?: GenerationQualityTier;
}

export function createGenerationJob(input: CreateJobInput) {
  const pointsCost =
    input.toolType ?
      estimateToolPoints(input.toolType, input.resolution, input.count)
    : estimatePoints(input.modelId, input.count, input.resolution);

  const user = db
    .prepare("SELECT credits FROM users WHERE id = ?")
    .get(input.userId) as { credits: number } | undefined;

  if (!user) {
    throw new AppError(404, "NOT_FOUND", "用户不存在");
  }
  assertEmailVerifiedForSpend(input.userId);
  if (user.credits < pointsCost) {
    throw new AppError(402, "INSUFFICIENT_CREDITS", "积分不足，请充值后再试");
  }

  assertSessionWrite(input.userId, input.sessionId);

  const modelMeta = getModel(input.modelId);
  if (
    input.toolType &&
    !isEcommerceSetToolType(input.toolType) &&
    modelMeta?.type !== "video"
  ) {
    assertToolProviderReady(input.toolType, input.userId);
  } else if (modelMeta?.type !== "video") {
    resolveProvider(input.modelId, "generate", {
      hasReferenceImages: Boolean(input.referenceUrls?.length),
      userId: input.userId,
    });
  }

  const jobId = randomUUID();
  const userMessageId = randomUUID();
  const sourceLane = inferSourceLane({
    sourceLane: input.sourceLane,
    toolType: input.toolType,
  });

  let effectiveToolContext:
    | (Partial<ToolContext> & {
        referenceUrls?: string[];
        autoRoute?: boolean;
        routingMode?: GenerationRoutingMode;
        qualityTier?: GenerationQualityTier;
      })
    | undefined;
  if (
    input.toolContext ||
    input.referenceUrls?.length ||
    input.autoRoute !== undefined ||
    input.routingMode !== undefined ||
    input.qualityTier !== undefined
  ) {
    effectiveToolContext = {
      ...input.toolContext,
      referenceUrls: input.referenceUrls,
      ...(input.autoRoute !== undefined ? { autoRoute: input.autoRoute } : {}),
      ...(input.routingMode ? { routingMode: input.routingMode } : {}),
      ...(input.qualityTier ? { qualityTier: input.qualityTier } : {}),
    };
  }

  db.transaction(() => {
    db.prepare(
      "UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?",
    ).run(pointsCost, input.userId, pointsCost);

    db.prepare(
      `INSERT INTO generation_jobs
       (id, session_id, user_id, model_id, prompt, mode, count, resolution, aspect_ratio, status, points_cost, tool_type, tool_context, parent_job_id, source_output_id, source_lane)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?)`,
    ).run(
      jobId,
      input.sessionId,
      input.userId,
      input.modelId,
      input.prompt,
      input.mode,
      input.count,
      input.resolution,
      input.aspectRatio ?? "1:1",
      pointsCost,
      input.toolType ?? null,
      effectiveToolContext ? JSON.stringify(effectiveToolContext) : null,
      input.parentJobId ?? null,
      input.sourceOutputId ?? null,
      sourceLane,
    );

    db.prepare(
      `INSERT INTO messages (id, session_id, role, content, job_id)
       VALUES (?, ?, 'user', ?, ?)`,
    ).run(userMessageId, input.sessionId, input.prompt, jobId);

    db.prepare(
      "UPDATE image_sessions SET status = 'running', updated_at = datetime('now') WHERE id = ?",
    ).run(input.sessionId);

    if (input.mode === "ecommerce") {
      const session = db
        .prepare("SELECT title FROM image_sessions WHERE id = ?")
        .get(input.sessionId) as { title: string } | undefined;
      const autoTitles = new Set(["未命名", "新建项目", "新建画布"]);
      if (session && autoTitles.has(session.title)) {
        db.prepare("UPDATE image_sessions SET title = ? WHERE id = ?").run(
          "电商套图",
          input.sessionId,
        );
      }
    }
  });

  void enqueueJob({ jobId, slideLabels: input.slideLabels });

  return { jobId, pointsCost, userMessageId };
}

export async function processGenerationJob({
  jobId,
  slideLabels,
}: JobQueuePayload) {
  const job = db
    .prepare(
      `SELECT id, session_id, user_id, prompt, count, points_cost, status, mode, tool_type, tool_context, model_id, resolution, aspect_ratio
       FROM generation_jobs WHERE id = ?`,
    )
    .get(jobId) as
    | {
        id: string;
        session_id: string;
        user_id: string;
        prompt: string;
        count: number;
        points_cost: number;
        status: string;
        mode: string;
        tool_type: string | null;
        tool_context: string | null;
        model_id: string;
        resolution: string;
        aspect_ratio: string;
      }
    | undefined;

  if (!job || job.status !== "queued") return;

  let startedMs = Date.now();
  const createdRow = db
    .prepare("SELECT created_at FROM generation_jobs WHERE id = ?")
    .get(jobId) as { created_at: string } | undefined;
  if (createdRow?.created_at) {
    const parsed = Date.parse(
      createdRow.created_at.includes("T")
        ? createdRow.created_at
        : `${createdRow.created_at.replace(" ", "T")}Z`,
    );
    if (!Number.isNaN(parsed)) startedMs = parsed;
  }

  db.prepare("UPDATE generation_jobs SET status = 'running' WHERE id = ?").run(
    jobId,
  );

  const model = getModel(job.model_id);
  const isToolJob =
    Boolean(job.tool_type) && !isEcommerceSetToolType(job.tool_type);

  let toolContext: ToolContext | Record<string, unknown> | undefined;
  let referenceUrls: string[] | undefined;
  let autoRoute = false;
  let routingMode: GenerationRoutingMode | undefined;
  let qualityTier: GenerationQualityTier | undefined;
  let videoReferenceMode:
    | "omni"
    | "first-last"
    | "smart-multi-frame"
    | undefined;
  let videoDurationSec: number | undefined;
  let videoResolution: "720P" | "1080P" | undefined;
  let videoReferences: Array<VideoMediaRef & { url?: string }> | undefined;
  let smartMultiShots: Array<SmartMultiShot & { url?: string }> | undefined;
  if (job.tool_context) {
    try {
      const parsed = JSON.parse(job.tool_context) as ToolContext & {
        referenceUrls?: string[];
        autoRoute?: boolean;
        routingMode?: GenerationRoutingMode;
        qualityTier?: GenerationQualityTier;
        videoReferenceMode?:
          | "omni"
          | "first-frame"
          | "first-last"
          | "smart-multi-frame";
        durationSec?: number;
        videoResolution?: "720P" | "1080P";
        videoReferences?: typeof videoReferences;
        smartMultiShots?: typeof smartMultiShots;
      };
      toolContext = parsed;
      referenceUrls = parsed.referenceUrls;
      autoRoute = parsed.autoRoute === true;
      routingMode = parsed.routingMode;
      qualityTier = parsed.qualityTier;
      videoReferenceMode =
        parsed.videoReferenceMode === "first-frame"
          ? "first-last"
          : parsed.videoReferenceMode;
      videoDurationSec = parsed.durationSec;
      videoResolution = parsed.videoResolution;
      videoReferences = parsed.videoReferences;
      smartMultiShots = parsed.smartMultiShots;
    } catch {
      toolContext = undefined;
    }
  }

  const useMockDelay =
    model?.type === "video"
      ? resolveVideoProvider(job.model_id).name === "mock"
      : isToolJob
        ? resolveToolProvider(job.tool_type!, job.user_id).name.endsWith(
            "-mock",
          )
        : resolveProvider(job.model_id, "generate", {
            hasReferenceImages: Boolean(referenceUrls?.length),
            userId: job.user_id,
          }).name === "mock";
  if (useMockDelay) {
    await new Promise((r) => setTimeout(r, delayMs));
  }

  let imageProvider: string | null = null;

  try {
    const labels =
      slideLabels ??
      (job.mode === "ecommerce" && !job.tool_type
        ? ECOMMERCE_SLIDES.map((s) => s.label)
        : undefined);

    let urls: string[] = [];
    if (model?.type === "video") {
      const video = await generateVideos({
        prompt: job.prompt,
        modelId: job.model_id,
        count: job.count,
        resolution: job.resolution,
        aspectRatio: job.aspect_ratio ?? undefined,
        videoResolution,
        referenceUrls,
        videoReferences,
        smartMultiShots,
        referenceMode: videoReferenceMode,
        durationSec: videoDurationSec,
      });
      urls = video.urls;
    } else if (labels && labels.length > 1) {
      const assistantMessageId = randomUUID();
      db.prepare(
        `INSERT INTO messages (id, session_id, role, content, job_id)
         VALUES (?, ?, 'assistant', ?, ?)`,
      ).run(
        assistantMessageId,
        job.session_id,
        `正在生成 ${labels.length} 张套图…`,
        jobId,
      );

      for (let li = 0; li < labels.length; li++) {
        const label = labels[li];
        const part = await generateImages({
          prompt: `${job.prompt}\n【画面】${label}`,
          modelId: job.model_id,
          count: 1,
          resolution: job.resolution,
          aspectRatio: job.aspect_ratio ?? "1:1",
          referenceUrls,
          userId: job.user_id,
          autoRoute,
          routingMode,
          qualityTier,
        });
        const url = part.urls[0];
        imageProvider = part.provider;
        urls.push(url);
        const thumbUrl = await ensureThumbnail(url);

        db.transaction(() => {
          db.prepare(
            `INSERT INTO job_outputs (id, job_id, url, thumb_url, sort_order, label) VALUES (?, ?, ?, ?, ?, ?)`,
          ).run(randomUUID(), jobId, url, thumbUrl, li, label);
          db.prepare(
            `INSERT INTO message_outputs (id, message_id, url, thumb_url, sort_order, label) VALUES (?, ?, ?, ?, ?, ?)`,
          ).run(randomUUID(), assistantMessageId, url, thumbUrl, li, label);
          db.prepare(
            `UPDATE image_sessions SET updated_at = datetime('now') WHERE id = ?`,
          ).run(job.session_id);
        });
      }
    } else if (job.tool_type && job.tool_type !== "video") {
      const result = await runToolImages({
        toolId: job.tool_type,
        prompt: job.prompt,
        modelId: job.model_id,
        count: job.count,
        resolution: job.resolution,
        aspectRatio: job.aspect_ratio ?? "1:1",
        toolContext: toolContext as ToolContext | undefined,
        referenceUrls,
        userId: job.user_id,
      });
      urls = result.urls;
      imageProvider = result.provider;
    } else {
      const result = await generateImages({
        prompt: job.prompt,
        modelId: job.model_id,
        count: job.count,
        resolution: job.resolution,
        aspectRatio: job.aspect_ratio ?? "1:1",
        referenceUrls,
        userId: job.user_id,
        autoRoute,
        routingMode,
        qualityTier,
      });
      urls = result.urls;
      imageProvider = result.provider;
    }

    await assertOutputsAllowed(urls);
    const thumbUrls = await ensureThumbnails(urls);

    const outputs = urls.map((url, i) => ({
      url,
      thumbUrl: thumbUrls[i] ?? url,
      label: labels?.[i],
    }));

    const durationMs = Math.max(0, Date.now() - startedMs);
    const isMultiSlide = Boolean(labels && labels.length > 1);
    const assistantMessageId = randomUUID();
    const isVideo = model?.type === "video";
    const studioTool =
      job.tool_type && job.tool_type !== "video" ?
        getTool(job.tool_type)
      : undefined;
    const providerLabel = formatToolProviderLabel(imageProvider ?? undefined);
    const summary =
      job.mode === "ecommerce" && !job.tool_type
        ? `电商套图方案已生成，共 ${outputs.length} 张：${labels?.join("、") ?? ""}`
        : studioTool
          ? `精修 · ${studioTool.name} · 共 ${outputs.length} 张${providerLabel ? `（${providerLabel}）` : ""}。`
          : isVideo
            ? `生成 · 视频 · 共 ${outputs.length} 段（${model?.name ?? job.model_id}）。`
            : `生成 · 共 ${outputs.length} 张图片。`;

    if (isMultiSlide) {
      db.transaction(() => {
        db.prepare(
          `UPDATE messages SET content = ? WHERE job_id = ? AND role = 'assistant'`,
        ).run(summary, jobId);
        db.prepare(
          `UPDATE generation_jobs SET status = 'succeeded', image_provider = ?, completed_at = datetime('now') WHERE id = ?`,
        ).run(imageProvider, jobId);
        db.prepare(
          `UPDATE image_sessions SET status = 'idle', updated_at = datetime('now') WHERE id = ?`,
        ).run(job.session_id);
      });
    } else {
    db.transaction(() => {
      for (let i = 0; i < outputs.length; i++) {
        db.prepare(
          `INSERT INTO job_outputs (id, job_id, url, thumb_url, sort_order, label) VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(
          randomUUID(),
          jobId,
          outputs[i].url,
          outputs[i].thumbUrl,
          i,
          outputs[i].label ?? null,
        );
      }

      db.prepare(
        `INSERT INTO messages (id, session_id, role, content, job_id)
         VALUES (?, ?, 'assistant', ?, ?)`,
      ).run(assistantMessageId, job.session_id, summary, jobId);

      for (let i = 0; i < outputs.length; i++) {
        db.prepare(
          `INSERT INTO message_outputs (id, message_id, url, thumb_url, sort_order, label) VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(
          randomUUID(),
          assistantMessageId,
          outputs[i].url,
          outputs[i].thumbUrl,
          i,
          outputs[i].label ?? null,
        );
      }

      db.prepare(
        `UPDATE generation_jobs SET status = 'succeeded', image_provider = ?, completed_at = datetime('now') WHERE id = ?`,
      ).run(imageProvider, jobId);

      db.prepare(
        `UPDATE image_sessions SET status = 'idle', updated_at = datetime('now') WHERE id = ?`,
      ).run(job.session_id);
    });
    }

    recordAnalyticsEvent(job.user_id, "generation_success", {
      job_id: jobId,
      duration_ms: durationMs,
      points: job.points_cost,
      mode: job.mode,
    });
    notifyAgentJobCompleted(jobId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "生成失败";
    if (isToolJob && job.tool_type) {
      try {
        const providerName = resolveToolProvider(
          job.tool_type,
          job.user_id,
        ).name;
        recordProviderHealthFailure(providerName, message);
      } catch {
        /* 忽略探活缓存回写失败 */
      }
    }
    const errorCode =
      err instanceof AppError ? err.code : "GENERATION_ERROR";
    markGenerationJobFailed(jobId, message, errorCode);
  }
}

export type JobDetail = Record<string, unknown> & {
  status: string;
  error: string | null;
  outputs: { url: string; thumb_url?: string | null; sort_order: number }[];
  outputType: "image" | "video";
  queue_ahead?: number | null;
};

function countQueuedJobsAhead(
  jobId: string,
  status: string,
  createdAt: string | null | undefined,
): number | null {
  if (status !== "queued" || !createdAt) return null;
  const row = db
    .prepare(
      `SELECT COUNT(*) as c FROM generation_jobs
       WHERE status IN ('queued', 'running') AND created_at < ? AND id != ?`,
    )
    .get(createdAt, jobId) as { c: number } | undefined;
  return row?.c ?? 0;
}

export function getJob(jobId: string, userId?: string): JobDetail {
  reconcileStaleGenerationJob(jobId);

  const job = db
    .prepare(
      `SELECT id, session_id, user_id, model_id, prompt, mode, count, resolution,
              status, points_cost, error, tool_type, image_provider, source_lane,
              created_at, completed_at
       FROM generation_jobs WHERE id = ?`,
    )
    .get(jobId) as Record<string, unknown> | undefined;

  if (!job) {
    throw new AppError(404, "NOT_FOUND", "任务不存在");
  }
  if (userId) {
    assertSessionRead(userId, job.session_id as string);
  }

  const outputs = db
    .prepare(
      `SELECT url, thumb_url, sort_order FROM job_outputs WHERE job_id = ? ORDER BY sort_order ASC`,
    )
    .all(jobId) as { url: string; thumb_url: string | null; sort_order: number }[];

  const model = getModel(job.model_id as string);

  const detail: JobDetail = {
    ...job,
    status: String(job.status),
    error: job.error != null ? String(job.error) : null,
    outputs,
    outputType: (model?.type ?? "image") as "image" | "video",
    queue_ahead: countQueuedJobsAhead(
      jobId,
      String(job.status),
      job.created_at as string | undefined,
    ),
  };
  return detail;
}
