/**
 * Kling 3.0 视频模型（t2v / i2v）— 骨架实现
 * API 文档：https://api.klingai.com
 * 环境变量：KLING_API_KEY, KLING_API_URL
 */
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
    // TODO: 对接 Kling API（https://api.klingai.com）
    // 当前为骨架实现，返回 placeholder
    if (!process.env.KLING_API_KEY) throw new Error("KLING_API_KEY 未配置");

    const baseUrl = process.env.KLING_API_URL?.trim() || "https://api.klingai.com";

    // 预留 API 调用结构：文生视频 / 图生视频
    const mode = params.referenceUrls?.length || params.videoReferences?.length
      ? "i2v"
      : "t2v";

    // TODO: 实际对接时替换为异步任务提交 + 轮询逻辑
    void baseUrl;
    void mode;

    throw new Error(
      `Kling 3.0 视频生成尚未实现（modelId=${params.modelId}, mode=${mode}），请等待后续迭代`,
    );
  },
};
