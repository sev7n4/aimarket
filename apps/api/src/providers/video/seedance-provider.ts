/**
 * Seedance 2.0 视频模型（t2v / i2v）— 骨架实现
 * API 文档：字节跳动 Seedance API
 * 环境变量：SEEDANCE_API_KEY, SEEDANCE_API_URL
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

export const SEEDANCE_VIDEO_MODEL_ID = "seedance-2.0";

export function seedanceVideoConfigured(): boolean {
  return Boolean(process.env.SEEDANCE_API_KEY?.trim());
}

export const seedanceVideoProvider: VideoProvider = {
  name: "seedance-video",
  supports(modelId: string): boolean {
    if (!seedanceVideoConfigured()) return false;
    return modelId === SEEDANCE_VIDEO_MODEL_ID;
  },
  async generate(params: VideoGenerateParams): Promise<VideoGenerateResult> {
    if (httpVideoGatewayConfigured()) {
      return generateViaHttpGateway(params, "seedance-video");
    }
    if (!process.env.SEEDANCE_API_KEY) throw new Error("SEEDANCE_API_KEY 未配置");

    const mode =
      params.referenceUrls?.length || params.videoReferences?.length
        ? "i2v"
        : "t2v";
    throw new Error(
      `Seedance 2.0 原生 API 尚未实现（modelId=${params.modelId}, mode=${mode}），请配置 VIDEO_API_URL`,
    );
  },
};
