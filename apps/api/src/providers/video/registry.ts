import { AGNES_VIDEO_MODEL_ID } from "./agnes.js";
import type { VideoGenerateParams, VideoGenerateResult } from "./types.js";
import {
  getVideoModelRoutes,
  resolveVideoModelRoute,
  resolveVideoProvider,
} from "./routing.js";

export { resolveVideoProvider, resolveVideoModelRoute, getVideoModelRoutes };
export type { VideoModelRouteMeta } from "./routing.js";

export async function generateVideos(
  params: VideoGenerateParams,
): Promise<VideoGenerateResult> {
  const provider = resolveVideoProvider(params.modelId);
  return provider.generate(params);
}

/** 创作台 Auto 视频应解析到的 modelId（与 resolveVideoProvider 一致） */
export function resolveDefaultVideoModelId(): string {
  const mode = process.env.VIDEO_PROVIDER ?? "auto";
  if (mode === "mock") return "seedance-2";

  const routes = getVideoModelRoutes();
  const preferred = ["wan-2.6", "agnes-video", "seedance-2"] as const;
  for (const id of preferred) {
    const route = routes.find((r) => r.modelId === id);
    if (route?.available) return id;
  }
  return AGNES_VIDEO_MODEL_ID;
}

export function getVideoProviderStatus() {
  const routes = getVideoModelRoutes();
  const defaultId = resolveDefaultVideoModelId();
  const defaultRoute = resolveVideoModelRoute(defaultId);
  return {
    mode: process.env.VIDEO_PROVIDER ?? "auto",
    httpConfigured: Boolean(process.env.VIDEO_API_URL?.trim()),
    dashscopeConfigured: Boolean(process.env.DASHSCOPE_API_KEY?.trim()),
    agnesConfigured: Boolean(process.env.AGNES_API_KEY?.trim()),
    agnesVideoModel: process.env.AGNES_VIDEO_MODEL ?? "agnes-video-v2.0",
    activeProvider: defaultRoute.provider,
    defaultModelId: defaultId,
    modelRoutes: routes,
  };
}
