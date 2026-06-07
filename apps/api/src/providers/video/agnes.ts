/**
 * Agnes Video V2.0 — 异步任务 POST /v1/videos + GET /v1/videos/{id}
 */
import type {
  VideoGenerateParams,
  VideoGenerateResult,
  VideoProvider,
} from "./types.js";

export const AGNES_VIDEO_MODEL_ID = "agnes-video";

const VIDEO_ALIASES = new Set([AGNES_VIDEO_MODEL_ID, "agnes-video-v2.0", "seedance-2"]);

function agnesVideoApiModel(): string {
  return process.env.AGNES_VIDEO_MODEL?.trim() || "agnes-video-v2.0";
}

export function agnesVideoConfigured(): boolean {
  return Boolean(process.env.AGNES_API_KEY?.trim());
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

async function pollVideoTask(
  base: string,
  apiKey: string,
  taskId: string,
): Promise<string> {
  const intervalMs = Number(process.env.AGNES_VIDEO_POLL_INTERVAL_MS ?? 8_000);
  const timeoutMs = Number(process.env.AGNES_VIDEO_POLL_TIMEOUT_MS ?? 600_000);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await fetch(`${base}/videos/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Agnes Video 轮询失败 (${res.status}): ${errText.slice(0, 200)}`);
    }
    const task = (await res.json()) as Record<string, unknown>;
    const status = String(task.status ?? "");
    if (status === "completed") {
      const url = extractVideoUrl(task);
      if (url) return url;
      throw new Error("Agnes Video 完成但缺少下载 URL");
    }
    if (status === "failed") {
      throw new Error(
        `Agnes Video 任务失败: ${String(task.error ?? "unknown")}`,
      );
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Agnes Video 任务超时 (${taskId})`);
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

    const base = (
      process.env.AGNES_API_BASE_URL ?? "https://apihub.agnes-ai.com/v1"
    ).replace(/\/$/, "");

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

    const createRes = await fetch(`${base}/videos`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => "");
      throw new Error(`Agnes Video 创建失败 (${createRes.status}): ${errText.slice(0, 300)}`);
    }

    const created = (await createRes.json()) as Record<string, unknown>;
    const taskId = String(created.id ?? created.task_id ?? "");
    if (!taskId) {
      throw new Error("Agnes Video 未返回 task id");
    }

    const videoUrl = await pollVideoTask(base, apiKey, taskId);
    return {
      urls: [videoUrl].slice(0, params.count),
      provider: "agnes-video",
    };
  },
};
