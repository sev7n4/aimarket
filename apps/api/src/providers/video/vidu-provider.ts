/**
 * Vidu 视频模型（t2v / i2v）— 骨架实现
 * API 文档：Vidu API
 * 环境变量：VIDU_API_KEY, VIDU_API_URL
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

export const VIDU_VIDEO_MODEL_ID = "vidu";

export function viduVideoConfigured(): boolean {
  return Boolean(process.env.VIDU_API_KEY?.trim());
}

export const viduVideoProvider: VideoProvider = {
  name: "vidu-video",
  supports(modelId: string): boolean {
    if (!viduVideoConfigured()) return false;
    return modelId === VIDU_VIDEO_MODEL_ID;
  },
  async generate(params: VideoGenerateParams): Promise<VideoGenerateResult> {
    if (httpVideoGatewayConfigured()) {
      return generateViaHttpGateway(params, "vidu-video");
    }
    if (!process.env.VIDU_API_KEY) throw new Error("VIDU_API_KEY 未配置");

    const mode =
      params.referenceUrls?.length || params.videoReferences?.length
        ? "i2v"
        : "t2v";
    throw new Error(
      `Vidu 原生 API 尚未实现（modelId=${params.modelId}, mode=${mode}），请配置 VIDEO_API_URL`,
    );
  },
};
