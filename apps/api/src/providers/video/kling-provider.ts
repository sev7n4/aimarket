/**
 * Kling 3.0 视频模型（t2v / i2v）— 骨架实现
 * API 文档：https://api.klingai.com
 * 环境变量：KLING_API_KEY, KLING_API_URL
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

export const KLING_VIDEO_MODEL_ID = "kling-3.0";

export function klingVideoConfigured(): boolean {
  return Boolean(process.env.KLING_API_KEY?.trim());
}

export const klingVideoProvider: VideoProvider = {
  name: "kling-video",
  supports(modelId: string): boolean {
    if (!klingVideoConfigured()) return false;
    return modelId === KLING_VIDEO_MODEL_ID;
  },
  async generate(params: VideoGenerateParams): Promise<VideoGenerateResult> {
    if (httpVideoGatewayConfigured()) {
      return generateViaHttpGateway(params, "kling-video");
    }
    if (!process.env.KLING_API_KEY) throw new Error("KLING_API_KEY 未配置");

    const mode =
      params.referenceUrls?.length || params.videoReferences?.length
        ? "i2v"
        : "t2v";
    throw new Error(
      `Kling 3.0 原生 API 尚未实现（modelId=${params.modelId}, mode=${mode}），请配置 VIDEO_API_URL`,
    );
  },
};
