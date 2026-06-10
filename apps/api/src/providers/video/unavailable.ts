import type {
  VideoGenerateParams,
  VideoGenerateResult,
  VideoProvider,
} from "./types.js";
import { resolveVideoModelRoute } from "./routing.js";

export const unavailableVideoProvider: VideoProvider = {
  name: "unavailable",
  supports: () => false,
  async generate(params: VideoGenerateParams): Promise<VideoGenerateResult> {
    const route = resolveVideoModelRoute(params.modelId);
    throw new Error(
      route.unavailableReason ??
        `视频模型 ${params.modelId} 当前不可用，请检查服务端视频供应商配置`,
    );
  },
};
