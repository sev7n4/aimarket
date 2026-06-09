/**
 * Agnes Video V2.0 — 异步任务 POST /v1/videos + GET /v1/videos/{id}
 * 文档：https://agnes-ai.com/doc/agnes-video-v20
 */
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
        `Agnes Video 任务失败: ${String(task.error ?? "unknown")}`,
      );
    }
    await sleep(intervalMs);
  }
  throw new Error(
    `Agnes Video 任务超时 (${taskId}, 最后状态 ${lastStatus}, progress=${lastProgress ?? "n/a"}, polls=${polls}, timeoutMs=${timeoutMs})`,
  );
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
    const numFrames = resolveVideoFrames(params.durationSec);
    const body: Record<string, unknown> = {
      model: agnesVideoApiModel(),
      prompt: params.prompt.slice(0, 4000),
      width: 1152,
      height: 768,
      num_frames: numFrames,
      frame_rate: 24,
    };
    const ref = params.referenceUrls?.[0];
    if (ref) {
      body.image = ref;
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
      `[agnes-video] created task=${taskId} frames=${numFrames} hasImage=${Boolean(ref)}`,
    );

    const videoUrl = await pollVideoTask(base, apiKey, taskId);
    return {
      urls: [videoUrl].slice(0, params.count),
      provider: "agnes-video",
    };
  },
};
