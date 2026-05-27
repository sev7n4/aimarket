import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { ECOMMERCE_SLIDES } from "./ecommerce.js";
import { estimatePoints, estimateToolPoints } from "./pricing.js";
import { getModel } from "./models.js";
import { getTool } from "./tools.js";
import { AppError } from "./errors.js";
import { assertSessionWrite, assertSessionRead } from "./session-access.js";
import { recordAnalyticsEvent } from "./analytics.js";
import { assertOutputsAllowed } from "./content-moderation.js";
import { generateImages, resolveProvider } from "../providers/registry.js";
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

const delayMs = Number(process.env.MOCK_GENERATION_DELAY_MS ?? 2500);

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
  slideLabels?: string[];
}

export function createGenerationJob(input: CreateJobInput) {
  const pointsCost =
    input.toolType ?
      estimateToolPoints(input.modelId, input.toolType, input.resolution)
    : estimatePoints(input.modelId, input.count, input.resolution);

  const user = db
    .prepare("SELECT credits FROM users WHERE id = ?")
    .get(input.userId) as { credits: number } | undefined;

  if (!user) {
    throw new AppError(404, "NOT_FOUND", "用户不存在");
  }
  if (user.credits < pointsCost) {
    throw new AppError(402, "INSUFFICIENT_CREDITS", "积分不足，请充值后再试");
  }

  assertSessionWrite(input.userId, input.sessionId);

  const modelMeta = getModel(input.modelId);
  if (modelMeta?.type !== "video") {
    resolveProvider(input.modelId);
  }

  const jobId = randomUUID();
  const userMessageId = randomUUID();

  db.transaction(() => {
    db.prepare(
      "UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?",
    ).run(pointsCost, input.userId, pointsCost);

    db.prepare(
      `INSERT INTO generation_jobs
       (id, session_id, user_id, model_id, prompt, mode, count, resolution, aspect_ratio, status, points_cost, tool_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)`,
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
      `SELECT id, session_id, user_id, prompt, count, points_cost, status, mode, tool_type, model_id, resolution, aspect_ratio
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
  const isToolJob = Boolean(job.tool_type);
  const useMockDelay =
    model?.type === "video"
      ? resolveVideoProvider(job.model_id).name === "mock"
      : isToolJob
        ? resolveToolProvider(job.tool_type!).name.endsWith("-mock")
        : resolveProvider(job.model_id).name === "mock";
  if (useMockDelay) {
    await new Promise((r) => setTimeout(r, delayMs));
  }

  let imageProvider: string | null = null;

  try {
    const labels =
      slideLabels ??
      (job.mode === "ecommerce"
        ? ECOMMERCE_SLIDES.map((s) => s.label)
        : undefined);

    let urls: string[] = [];

    if (model?.type === "video") {
      const video = await generateVideos({
        prompt: job.prompt,
        modelId: job.model_id,
        count: job.count,
        resolution: job.resolution,
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
        });
        const url = part.urls[0];
        imageProvider = part.provider;
        urls.push(url);

        db.transaction(() => {
          db.prepare(
            `INSERT INTO job_outputs (id, job_id, url, sort_order, label) VALUES (?, ?, ?, ?, ?)`,
          ).run(randomUUID(), jobId, url, li, label);
          db.prepare(
            `INSERT INTO message_outputs (id, message_id, url, sort_order, label) VALUES (?, ?, ?, ?, ?)`,
          ).run(randomUUID(), assistantMessageId, url, li, label);
          db.prepare(
            `UPDATE image_sessions SET updated_at = datetime('now') WHERE id = ?`,
          ).run(job.session_id);
        });
      }
    } else if (job.tool_type) {
      const result = await runToolImages({
        toolId: job.tool_type,
        prompt: job.prompt,
        modelId: job.model_id,
        count: job.count,
        resolution: job.resolution,
        aspectRatio: job.aspect_ratio ?? "1:1",
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
      });
      urls = result.urls;
      imageProvider = result.provider;
    }

    await assertOutputsAllowed(urls);

    const outputs = urls.map((url, i) => ({
      url,
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
    const summary =
      job.mode === "ecommerce"
        ? `电商套图方案已生成，共 ${outputs.length} 张：${labels?.join("、") ?? ""}`
        : studioTool
          ? `「${studioTool.name}」处理完成，共 ${outputs.length} 张。`
          : isVideo
            ? `已生成 ${outputs.length} 段视频（${model?.name ?? job.model_id}）。`
            : `已根据你的描述生成 ${outputs.length} 张图片。`;

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
          `INSERT INTO job_outputs (id, job_id, url, sort_order, label) VALUES (?, ?, ?, ?, ?)`,
        ).run(randomUUID(), jobId, outputs[i].url, i, outputs[i].label ?? null);
      }

      db.prepare(
        `INSERT INTO messages (id, session_id, role, content, job_id)
         VALUES (?, ?, 'assistant', ?, ?)`,
      ).run(assistantMessageId, job.session_id, summary, jobId);

      for (let i = 0; i < outputs.length; i++) {
        db.prepare(
          `INSERT INTO message_outputs (id, message_id, url, sort_order, label) VALUES (?, ?, ?, ?, ?)`,
        ).run(
          randomUUID(),
          assistantMessageId,
          outputs[i].url,
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "生成失败";
    const errorCode =
      err instanceof AppError ? err.code : "GENERATION_ERROR";
    const durationMs = Math.max(0, Date.now() - startedMs);
    recordAnalyticsEvent(job.user_id, "generation_fail", {
      job_id: jobId,
      error_code: errorCode,
      duration_ms: durationMs,
    });
    db.transaction(() => {
      db.prepare(
        `UPDATE generation_jobs SET status = 'failed', error = ?, completed_at = datetime('now') WHERE id = ?`,
      ).run(message, jobId);
      db.prepare(
        "UPDATE users SET credits = credits + ? WHERE id = ?",
      ).run(job.points_cost, job.user_id);
      db.prepare(
        `UPDATE image_sessions SET status = 'idle', updated_at = datetime('now') WHERE id = ?`,
      ).run(job.session_id);
      db.prepare(
        `INSERT INTO messages (id, session_id, role, content, job_id)
         VALUES (?, ?, 'assistant', ?, ?)`,
      ).run(
        randomUUID(),
        job.session_id,
        `生成失败：${message}，积分已退回。`,
        jobId,
      );
    });
  }
}

export type JobDetail = Record<string, unknown> & {
  status: string;
  error: string | null;
  outputs: { url: string; sort_order: number }[];
  outputType: "image" | "video";
};

export function getJob(jobId: string, userId?: string): JobDetail {
  const job = db
    .prepare(
      `SELECT id, session_id, user_id, model_id, prompt, mode, count, resolution,
              status, points_cost, error, tool_type, created_at, completed_at
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
      `SELECT url, sort_order FROM job_outputs WHERE job_id = ? ORDER BY sort_order ASC`,
    )
    .all(jobId) as { url: string; sort_order: number }[];

  const model = getModel(job.model_id as string);

  const detail: JobDetail = {
    ...job,
    status: String(job.status),
    error: job.error != null ? String(job.error) : null,
    outputs,
    outputType: (model?.type ?? "image") as "image" | "video",
  };
  return detail;
}
