/**
 * 万相 2.7 视频（t2v / i2v / r2v）— DashScope 异步 video-synthesis
 */
import {
  dashScopeBaseUrl,
  type DashScopeTaskResponse,
} from "../../lib/dashscope-async.js";
import {
  buildSmartMultiFramePrompt,
  normalizeVideoReferenceMode,
  type ResolvedVideoMediaRef,
  type SmartMultiShot,
  type VideoReferenceMode,
  type VideoResolution,
} from "../../lib/video-references.js";
import {
  coerceVideoDuration,
  mapAspectRatioForWan,
  wanAspectRatioDegradationNote,
} from "../../lib/video-output-presets.js";
import type {
  VideoGenerateParams,
  VideoGenerateResult,
  VideoProvider,
} from "./types.js";

const WAN_MODEL_IDS = new Set(["wan-2.6", "wan-2.7"]);

function t2vModel(): string {
  return process.env.ALIYUN_WAN_VIDEO_T2V_MODEL?.trim() || "wan2.7-t2v";
}

function i2vModel(): string {
  return process.env.ALIYUN_WAN_VIDEO_I2V_MODEL?.trim() || "wan2.7-i2v";
}

function r2vModel(): string {
  return process.env.ALIYUN_WAN_VIDEO_R2V_MODEL?.trim() || "wan2.7-r2v";
}

function pollIntervalMs(): number {
  return Number(process.env.ALIYUN_WAN_VIDEO_POLL_INTERVAL_MS ?? 5_000);
}

function pollTimeoutMs(): number {
  return Number(process.env.ALIYUN_WAN_VIDEO_POLL_TIMEOUT_MS ?? 900_000);
}

export function aliyunWanVideoConfigured(): boolean {
  return Boolean(process.env.DASHSCOPE_API_KEY?.trim());
}

type WanMediaItem = {
  type: string;
  url: string;
  reference_voice?: string;
};

function wanMediaFromRef(ref: ResolvedVideoMediaRef): WanMediaItem {
  if (ref.role === "first_frame") {
    return { type: "first_frame", url: ref.url };
  }
  if (ref.role === "last_frame") {
    return { type: "last_frame", url: ref.url };
  }
  if (ref.mediaType === "video") {
    return { type: "reference_video", url: ref.url };
  }
  return { type: "reference_image", url: ref.url };
}

function resolveWanModelAndInput(params: VideoGenerateParams): {
  model: string;
  input: Record<string, unknown>;
  degradationNote?: string;
} {
  const mode = normalizeVideoReferenceMode(params.referenceMode ?? "omni");
  const refs = (params.videoReferences ?? []).filter(
    (r): r is ResolvedVideoMediaRef => Boolean(r.url),
  ) as ResolvedVideoMediaRef[];

  if (mode === "smart-multi-frame" && params.smartMultiShots?.length) {
    const shots = params.smartMultiShots.filter((s) => s.motionPrompt.trim());
    const prompt = buildSmartMultiFramePrompt(params.prompt, shots);
    const media: WanMediaItem[] = [];
    for (const shot of shots) {
      if (shot.url) {
        media.push({ type: "reference_image", url: shot.url });
      }
    }
    return {
      model: t2vModel(),
      input: { prompt, ...(media.length ? { media } : {}) },
    };
  }

  if (mode === "first-last") {
    const first =
      refs.find((r) => r.role === "first_frame") ??
      refs.find((r) => r.mediaType === "image");
    const last = refs.find((r) => r.role === "last_frame");
    const legacyFirst = params.referenceUrls?.[0];
    const legacyLast = params.referenceUrls?.[1];
    const media: WanMediaItem[] = [];
    const firstUrl = first?.url ?? legacyFirst;
    const lastUrl = last?.url ?? legacyLast;
    if (firstUrl) media.push({ type: "first_frame", url: firstUrl });
    if (lastUrl) media.push({ type: "last_frame", url: lastUrl });
    if (!media.length && legacyFirst) {
      media.push({ type: "first_frame", url: legacyFirst });
    }
    return {
      model: i2vModel(),
      input: {
        prompt: params.prompt,
        media,
      },
      degradationNote:
        !lastUrl && media.length === 1
          ? "仅首帧：万相将按首帧图生视频"
          : undefined,
    };
  }

  if (mode === "omni" && (refs.length || params.referenceUrls?.length)) {
    const notes: string[] = [];
    const media: WanMediaItem[] = refs.length
      ? refs.flatMap((r) => {
          if (r.mediaType === "audio") {
            notes.push("音频参考暂不支持，已忽略");
            return [];
          }
          return [wanMediaFromRef(r)];
        })
      : (params.referenceUrls ?? []).map((url) => ({
          type: "reference_image",
          url,
        }));
    return {
      model: r2vModel(),
      input: { prompt: params.prompt, media },
      degradationNote: notes.length ? notes.join("；") : undefined,
    };
  }

  if (params.referenceUrls?.length) {
    const media: WanMediaItem[] = params.referenceUrls.map((url) => ({
      type: "first_frame",
      url,
    }));
    return {
      model: i2vModel(),
      input: { prompt: params.prompt, media },
    };
  }

  return {
    model: t2vModel(),
    input: { prompt: params.prompt },
  };
}

async function submitWanVideoTask(
  payload: Record<string, unknown>,
): Promise<string> {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  if (!apiKey) throw new Error("DASHSCOPE_API_KEY 未配置");

  const base = dashScopeBaseUrl();
  const res = await fetch(
    `${base}/api/v1/services/aigc/video-generation/video-synthesis`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `万相视频提交失败 (${res.status}): ${errText.slice(0, 300)}`,
    );
  }

  const json = (await res.json()) as DashScopeTaskResponse;
  if (json.code) {
    throw new Error(`万相视频业务错误 ${json.code}: ${json.message ?? ""}`);
  }
  const taskId = json.output?.task_id;
  if (!taskId) throw new Error("万相视频未返回 task_id");
  return taskId;
}

async function pollWanVideoTask(taskId: string): Promise<string> {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  if (!apiKey) throw new Error("DASHSCOPE_API_KEY 未配置");

  const base = dashScopeBaseUrl();
  const timeoutMs = pollTimeoutMs();
  const intervalMs = pollIntervalMs();
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const res = await fetch(`${base}/api/v1/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `万相视频任务查询失败 (${res.status}): ${errText.slice(0, 200)}`,
      );
    }

    const json = (await res.json()) as DashScopeTaskResponse & {
      output?: { video_url?: string; task_status?: string; message?: string };
    };
    const status = json.output?.task_status;

    if (status === "SUCCEEDED") {
      const videoUrl = json.output?.video_url;
      if (typeof videoUrl === "string" && videoUrl.length > 0) {
        return videoUrl;
      }
      const fromResults = (json.output?.results ?? [])
        .map((r) => r.url)
        .find((u): u is string => typeof u === "string" && u.length > 0);
      if (fromResults) return fromResults;
      throw new Error("万相视频任务成功但缺少 video_url");
    }

    if (status === "FAILED" || status === "CANCELED") {
      throw new Error(
        json.output?.message ?? json.message ?? `万相视频任务失败 (${status})`,
      );
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("万相视频任务超时");
}

function buildWanParameters(params: VideoGenerateParams): Record<string, unknown> {
  const mode = normalizeVideoReferenceMode(params.referenceMode ?? "omni");
  const shotCount = params.smartMultiShots?.length ?? 2;
  const duration = coerceVideoDuration(
    mode,
    params.durationSec,
    shotCount,
  );
  const resolution: VideoResolution =
    params.videoResolution === "720P" ? "720P" : "1080P";
  const ratio = mapAspectRatioForWan(params.aspectRatio ?? "16:9");

  return {
    resolution,
    ratio,
    duration,
    prompt_extend: true,
    watermark: false,
  };
}

export const aliyunWanVideoProvider: VideoProvider = {
  name: "aliyun-wan-video",
  supports(modelId) {
    if (!aliyunWanVideoConfigured()) return false;
    return WAN_MODEL_IDS.has(modelId);
  },
  async generate(params: VideoGenerateParams): Promise<VideoGenerateResult> {
    const { model, input, degradationNote } = resolveWanModelAndInput(params);
    const parameters = buildWanParameters(params);
    const aspectNote = wanAspectRatioDegradationNote(params.aspectRatio);
    const taskId = await submitWanVideoTask({ model, input, parameters });
    console.log(`[aliyun-wan-video] task=${taskId} model=${model}`);
    const videoUrl = await pollWanVideoTask(taskId);
    const notes = [degradationNote, aspectNote].filter(Boolean).join("；");
    return {
      urls: [videoUrl].slice(0, params.count),
      provider: "aliyun-wan-video",
      degradationNote: notes.length ? notes : undefined,
    };
  },
};

/** 测试用：mock fetch 时解析 payload */
export function buildWanVideoPayloadForTest(
  params: VideoGenerateParams,
): Record<string, unknown> {
  const { model, input } = resolveWanModelAndInput(params);
  return { model, input, parameters: buildWanParameters(params) };
}

export type { VideoReferenceMode, SmartMultiShot, VideoResolution };
