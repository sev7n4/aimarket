/**
 * Agnes Video V2.0 — 异步任务 POST /v1/videos + GET /v1/videos/{id}
 * 文档：https://agnes-ai.com/doc/agnes-video-v20
 */
import { setJobProviderTaskId } from "../../lib/job-provider-task.js";
import { formatProviderError } from "../../lib/provider-error.js";
import {
  buildSmartMultiFramePrompt,
  normalizeVideoReferenceMode,
} from "../../lib/video-references.js";
import { mapAspectRatioForWan } from "../../lib/video-output-presets.js";
import type {
  VideoGenerateParams,
  VideoGenerateResult,
  VideoProvider,
} from "./types.js";

export const AGNES_VIDEO_MODEL_ID = "agnes-video";

const VIDEO_ALIASES = new Set([AGNES_VIDEO_MODEL_ID, "agnes-video-v2.0", "seedance-2"]);

const DEFAULT_POLL_INTERVAL_MS = 8_000;
const DEFAULT_POLL_TIMEOUT_MS = 900_000;
const MAX_429_RETRIES = 5;

const RATIO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
  "1:1": { width: 960, height: 960 },
  "4:3": { width: 1104, height: 832 },
  "3:4": { width: 832, height: 1104 },
};

export type AgnesVideoTaskSnapshot = {
  taskId: string;
  status: string;
  progress: number | null;
  videoUrl: string | null;
  raw: Record<string, unknown>;
};

function agnesVideoApiModel(): string {
  return process.env.AGNES_VIDEO_MODEL?.trim() || "agnes-video-v2.0";
}

export function agnesVideoConfigured(): boolean {
  return Boolean(process.env.AGNES_API_KEY?.trim());
}

export function agnesVideoBaseUrl(): string {
  return (
    process.env.AGNES_API_BASE_URL ?? "https://apihub.agnes-ai.com/v1"
  ).replace(/\/$/, "");
}

function pollIntervalMs(): number {
  return Number(process.env.AGNES_VIDEO_POLL_INTERVAL_MS ?? DEFAULT_POLL_INTERVAL_MS);
}

function pollTimeoutMs(): number {
  return Number(process.env.AGNES_VIDEO_POLL_TIMEOUT_MS ?? DEFAULT_POLL_TIMEOUT_MS);
}

function resolveVideoFrames(durationSec?: number): number {
  const sec = durationSec ?? 5;
  if (sec <= 4) return 81;
  if (sec <= 6) return 121;
  if (sec <= 8) return 161;
  return 241;
}

function resolveDimensions(aspectRatio?: string): { width: number; height: number } {
  const ratio = mapAspectRatioForWan(aspectRatio ?? "16:9");
  return RATIO_DIMENSIONS[ratio] ?? RATIO_DIMENSIONS["16:9"]!;
}

function extractVideoUrl(task: Record<string, unknown>): string | null {
  const candidates = [
    task.video_url,
    task.remixed_from_video_id,
    task.output_url,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && /^https?:\/\//.test(c)) return c;
  }
  return null;
}

function parseTaskSnapshot(
  taskId: string,
  task: Record<string, unknown>,
): AgnesVideoTaskSnapshot {
  const progressRaw = task.progress;
  const progress =
    typeof progressRaw === "number"
      ? progressRaw
      : typeof progressRaw === "string" && progressRaw.trim()
        ? Number(progressRaw)
        : null;
  return {
    taskId,
    status: String(task.status ?? "unknown"),
    progress: Number.isFinite(progress) ? progress : null,
    videoUrl: extractVideoUrl(task),
    raw: task,
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** 429 上游饱和时线性退避重试（与 Agnes 官方 client 一致） */
async function fetchWith429Retry(
  url: string,
  init: RequestInit,
  label: string,
): Promise<Response> {
  let lastErr = "";
  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
    const res = await fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(60_000),
    });
    if (res.status !== 429) return res;
    lastErr = await res.text().catch(() => "");
    if (attempt >= MAX_429_RETRIES) break;
    const backoffMs = (attempt + 1) * 10_000;
    console.warn(
      `[agnes-video] ${label} 429 saturated, retry ${attempt + 1}/${MAX_429_RETRIES} in ${backoffMs}ms`,
    );
    await sleep(backoffMs);
  }
  throw new Error(
    `Agnes Video ${label} 上游饱和 (429): ${lastErr.slice(0, 200)}`,
  );
}

/** 管理/诊断：查询 Agnes 侧任务快照 */
export async function probeAgnesVideoTask(
  taskId: string,
): Promise<AgnesVideoTaskSnapshot> {
  const apiKey = process.env.AGNES_API_KEY?.trim();
  if (!apiKey) throw new Error("AGNES_API_KEY 未配置");
  const base = agnesVideoBaseUrl();
  const res = await fetchWith429Retry(
    `${base}/videos/${encodeURIComponent(taskId)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
    "probe",
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Agnes Video 查询失败 (${res.status}): ${errText.slice(0, 200)}`);
  }
  const task = (await res.json()) as Record<string, unknown>;
  return parseTaskSnapshot(taskId, task);
}

async function pollVideoTask(
  base: string,
  apiKey: string,
  taskId: string,
): Promise<string> {
  const intervalMs = pollIntervalMs();
  const timeoutMs = pollTimeoutMs();
  const deadline = Date.now() + timeoutMs;
  let lastStatus = "unknown";
  let lastProgress: number | null = null;
  let polls = 0;

  while (Date.now() < deadline) {
    polls += 1;
    const res = await fetchWith429Retry(
      `${base}/videos/${encodeURIComponent(taskId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
      "poll",
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Agnes Video 轮询失败 (${res.status}): ${errText.slice(0, 200)}`);
    }
    const task = (await res.json()) as Record<string, unknown>;
    const snap = parseTaskSnapshot(taskId, task);
    lastStatus = snap.status;
    lastProgress = snap.progress;

    if (polls === 1 || polls % 5 === 0 || snap.status !== "queued") {
      console.log(
        `[agnes-video] poll #${polls} task=${taskId} status=${snap.status} progress=${snap.progress ?? "n/a"}`,
      );
    }

    if (snap.status === "completed") {
      if (snap.videoUrl) return snap.videoUrl;
      throw new Error("Agnes Video 完成但缺少下载 URL");
    }
    if (snap.status === "failed") {
      throw new Error(
        `Agnes Video 任务失败: ${formatProviderError(task.error)}`,
      );
    }
    await sleep(intervalMs);
  }
  throw new Error(
    `Agnes Video 任务超时 (${taskId}, 最后状态 ${lastStatus}, progress=${lastProgress ?? "n/a"}, polls=${polls}, timeoutMs=${timeoutMs})`,
  );
}

function resolveAgnesPromptAndRef(params: VideoGenerateParams): {
  prompt: string;
  imageUrl?: string;
  degradationNote?: string;
} {
  const mode = normalizeVideoReferenceMode(params.referenceMode ?? "omni");
  const notes: string[] = [];

  if (mode === "smart-multi-frame" && params.smartMultiShots?.length) {
    notes.push("智能多帧已合并 prompt + 首图（Agnes 不支持多镜头 API）");
    const prompt = buildSmartMultiFramePrompt(
      params.prompt,
      params.smartMultiShots,
    );
    const firstShotUrl = params.smartMultiShots.find((s) => s.url)?.url;
    const ref =
      firstShotUrl ??
      params.videoReferences?.find((r) => r.mediaType === "image")?.url ??
      params.referenceUrls?.[0];
    return { prompt, imageUrl: ref, degradationNote: notes.join("；") };
  }

  if (mode === "first-last") {
    const first =
      params.videoReferences?.find((r) => r.role === "first_frame")?.url ??
      params.referenceUrls?.[0];
    const hasLast =
      Boolean(params.videoReferences?.find((r) => r.role === "last_frame")?.url) ||
      (params.referenceUrls?.length ?? 0) >= 2;
    if (!hasLast) notes.push("首尾帧将降级为仅首帧");
    return {
      prompt: params.prompt,
      imageUrl: first,
      degradationNote: notes.length ? notes.join("；") : undefined,
    };
  }

  if (mode === "omni") {
    const nonImages =
      params.videoReferences?.filter((r) => r.mediaType !== "image") ?? [];
    if (nonImages.length) {
      notes.push("音/视频参考不可用，已忽略");
    }
    const imageRef =
      params.videoReferences?.find((r) => r.mediaType === "image")?.url ??
      params.referenceUrls?.[0];
    if ((params.videoReferences?.length ?? params.referenceUrls?.length ?? 0) > 1) {
      notes.push("全能参考将降级为仅首图");
    }
    return {
      prompt: params.prompt,
      imageUrl: imageRef,
      degradationNote: notes.length ? notes.join("；") : undefined,
    };
  }

  return {
    prompt: params.prompt,
    imageUrl: params.referenceUrls?.[0],
  };
}

export const agnesVideoProvider: VideoProvider = {
  name: "agnes-video",
  supports(modelId) {
    if (!agnesVideoConfigured()) return false;
    return VIDEO_ALIASES.has(modelId);
  },
  async generate(params: VideoGenerateParams): Promise<VideoGenerateResult> {
    const apiKey = process.env.AGNES_API_KEY?.trim();
    if (!apiKey) throw new Error("AGNES_API_KEY 未配置");

    const base = agnesVideoBaseUrl();
    const { prompt, imageUrl, degradationNote } = resolveAgnesPromptAndRef(params);
    const { width, height } = resolveDimensions(params.aspectRatio);
    const numFrames = resolveVideoFrames(params.durationSec);
    const body: Record<string, unknown> = {
      model: agnesVideoApiModel(),
      prompt: prompt.slice(0, 4000),
      width,
      height,
      num_frames: numFrames,
      frame_rate: 24,
    };
    if (imageUrl) {
      body.image = imageUrl;
    }

    const createRes = await fetchWith429Retry(
      `${base}/videos`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      "create",
    );

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => "");
      throw new Error(`Agnes Video 创建失败 (${createRes.status}): ${errText.slice(0, 300)}`);
    }

    const created = (await createRes.json()) as Record<string, unknown>;
    const taskId = String(created.id ?? created.task_id ?? "");
    if (!taskId) {
      throw new Error("Agnes Video 未返回 task id");
    }
    console.log(
      `[agnes-video] created task=${taskId} frames=${numFrames} hasImage=${Boolean(imageUrl)} ${width}x${height}`,
    );
    setJobProviderTaskId(params.jobId, taskId);

    const videoUrl = await pollVideoTask(base, apiKey, taskId);
    return {
      urls: [videoUrl].slice(0, params.count),
      provider: "agnes-video",
      degradationNote,
    };
  },
};
