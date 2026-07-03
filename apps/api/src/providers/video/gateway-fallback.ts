import { httpVideoProvider } from "./http.js";
import type { VideoGenerateParams, VideoGenerateResult } from "./types.js";

export function httpVideoGatewayConfigured(): boolean {
  return Boolean(process.env.VIDEO_API_URL?.trim());
}

/**
 * 原生 Provider 未对接时，回退到通用 VIDEO_API_URL HTTP 网关。
 */
export async function generateViaHttpGateway(
  params: VideoGenerateParams,
  providerLabel: string,
): Promise<VideoGenerateResult> {
  if (!httpVideoGatewayConfigured()) {
    throw new Error(
      `${providerLabel} 原生 API 尚未实现，请配置 VIDEO_API_URL 作为 HTTP 网关`,
    );
  }
  if (!httpVideoProvider.supports(params.modelId)) {
    throw new Error(`HTTP 视频网关不支持模型 ${params.modelId}`);
  }
  const result = await httpVideoProvider.generate(params);
  return { ...result, provider: providerLabel };
}
