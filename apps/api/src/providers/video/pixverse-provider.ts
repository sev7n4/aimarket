/**
 * PixVerse 视频模型（t2v / i2v）— 骨架实现
 * API 文档：PixVerse API
 * 环境变量：PIXVERSE_API_KEY, PIXVERSE_API_URL
 */
import {
  generateViaHttpGateway,
  httpVideoGatewayConfigured,
} from "./gateway-fallback.js";
import type {
  VideoGenerateParams,
  VideoGenerateResult,
  VideoProvider,
} from "./types.js";

export const PIXVERSE_VIDEO_MODEL_ID = "pixverse";

export function pixverseVideoConfigured(): boolean {
  return Boolean(process.env.PIXVERSE_API_KEY?.trim());
}

export const pixverseVideoProvider: VideoProvider = {
  name: "pixverse-video",
  supports(modelId: string): boolean {
    if (!pixverseVideoConfigured()) return false;
    return modelId === PIXVERSE_VIDEO_MODEL_ID;
  },
  async generate(params: VideoGenerateParams): Promise<VideoGenerateResult> {
    if (httpVideoGatewayConfigured()) {
      return generateViaHttpGateway(params, "pixverse-video");
    }
    if (!process.env.PIXVERSE_API_KEY) throw new Error("PIXVERSE_API_KEY 未配置");

    const mode =
      params.referenceUrls?.length || params.videoReferences?.length
        ? "i2v"
        : "t2v";
    throw new Error(
      `PixVerse 原生 API 尚未实现（modelId=${params.modelId}, mode=${mode}），请配置 VIDEO_API_URL`,
    );
  },
};
