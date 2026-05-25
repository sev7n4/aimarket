import type {
  VideoGenerateParams,
  VideoGenerateResult,
  VideoProvider,
} from "./types.js";

export const mockVideoProvider: VideoProvider = {
  name: "mock",
  supports: () => true,
  async generate(params: VideoGenerateParams): Promise<VideoGenerateResult> {
    const urls: string[] = [];
    const seed = encodeURIComponent(params.prompt.slice(0, 24) || "video");
    for (let i = 0; i < params.count; i++) {
      urls.push(
        `https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4#${seed}-${params.modelId}-${i}`,
      );
    }
    return { urls, provider: "mock" };
  },
};
