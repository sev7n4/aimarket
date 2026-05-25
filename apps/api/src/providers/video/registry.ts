import { mockVideoProvider } from "./mock.js";
import { httpVideoProvider } from "./http.js";
import type { VideoGenerateParams, VideoGenerateResult } from "./types.js";

const providers = [httpVideoProvider, mockVideoProvider];

export function resolveVideoProvider(modelId: string) {
  const mode = process.env.VIDEO_PROVIDER ?? "auto";
  if (mode === "mock") return mockVideoProvider;
  if (mode === "http") return httpVideoProvider;

  if (process.env.VIDEO_API_URL && httpVideoProvider.supports(modelId)) {
    return httpVideoProvider;
  }
  return mockVideoProvider;
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
    activeProvider: resolveVideoProvider("seedance-2").name,
  };
}
