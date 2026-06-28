/**
 * Seedance 2.0 视频模型（t2v / i2v）— 骨架实现
 * API 文档：字节跳动 Seedance API
 * 环境变量：SEEDANCE_API_KEY, SEEDANCE_API_URL
 */
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
    // TODO: 对接 Seedance API
    // 当前为骨架实现，返回 placeholder
    if (!process.env.SEEDANCE_API_KEY) throw new Error("SEEDANCE_API_KEY 未配置");

    const baseUrl = process.env.SEEDANCE_API_URL?.trim() || "https://api.seedance.com";

    // 预留 API 调用结构：文生视频 / 图生视频
    const mode = params.referenceUrls?.length || params.videoReferences?.length
      ? "i2v"
      : "t2v";

    // TODO: 实际对接时替换为异步任务提交 + 轮询逻辑
    void baseUrl;
    void mode;

    throw new Error(
      `Seedance 2.0 视频生成尚未实现（modelId=${params.modelId}, mode=${mode}），请等待后续迭代`,
    );
  },
};
