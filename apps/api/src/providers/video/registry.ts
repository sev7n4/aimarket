import {
  agnesVideoConfigured,
  agnesVideoProvider,
  AGNES_VIDEO_MODEL_ID,
} from "./agnes.js";
import { mockVideoProvider } from "./mock.js";
import { httpVideoProvider } from "./http.js";
import type { VideoGenerateParams, VideoGenerateResult } from "./types.js";

const providers = [agnesVideoProvider, httpVideoProvider, mockVideoProvider];

export function resolveVideoProvider(modelId: string) {
  const mode = process.env.VIDEO_PROVIDER ?? "auto";
  if (mode === "mock") return mockVideoProvider;
  if (mode === "http") return httpVideoProvider;
  if (mode === "agnes") {
    return agnesVideoConfigured() ? agnesVideoProvider : mockVideoProvider;
  }

  if (agnesVideoConfigured() && agnesVideoProvider.supports(modelId)) {
    return agnesVideoProvider;
  }
  if (process.env.VIDEO_API_URL && httpVideoProvider.supports(modelId)) {
    return httpVideoProvider;
  }
  return mockVideoProvider;
}

/** 创作台 Auto 视频应解析到的 modelId（与 resolveVideoProvider 一致） */
export function resolveDefaultVideoModelId(): string {
  const mode = process.env.VIDEO_PROVIDER ?? "auto";
  if (mode === "mock") return "seedance-2";
  if (mode === "agnes" && agnesVideoConfigured()) return AGNES_VIDEO_MODEL_ID;
  if (mode === "http" && process.env.VIDEO_API_URL) return "seedance-2";
  if (agnesVideoConfigured()) return AGNES_VIDEO_MODEL_ID;
  if (process.env.VIDEO_API_URL) return "seedance-2";
  return "seedance-2";
}

export async function generateVideos(
  params: VideoGenerateParams,
): Promise<VideoGenerateResult> {
  const provider = resolveVideoProvider(params.modelId);
  return provider.generate(params);
}

export function getVideoProviderStatus() {
  return {
    mode: process.env.VIDEO_PROVIDER ?? "auto",
    httpConfigured: Boolean(process.env.VIDEO_API_URL),
    agnesConfigured: agnesVideoConfigured(),
    agnesVideoModel: process.env.AGNES_VIDEO_MODEL ?? "agnes-video-v2.0",
    activeProvider: resolveVideoProvider("agnes-video").name,
  };
}
