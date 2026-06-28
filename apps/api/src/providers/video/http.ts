import type {
  VideoGenerateParams,
  VideoGenerateResult,
  VideoProvider,
} from "./types.js";

const VIDEO_MODELS = new Set(["seedance-2", "wan-2.6", "kling-3.0", "seedance-2.0", "vidu", "pixverse"]);

/**
 * 通用 HTTP 视频 API（兼容 Replicate / 自建网关 JSON 响应）
 * 期望响应: { urls: string[] } 或 { output: string | string[] }
 */
export const httpVideoProvider: VideoProvider = {
  name: "http",
  supports: (modelId) => VIDEO_MODELS.has(modelId),
  async generate(params: VideoGenerateParams): Promise<VideoGenerateResult> {
    const base = process.env.VIDEO_API_URL;
    const key = process.env.VIDEO_API_KEY;
    if (!base) {
      throw new Error("未配置 VIDEO_API_URL");
    }

    const res = await fetch(base.replace(/\/$/, "") + "/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({
        prompt: params.prompt,
        model: params.modelId,
        count: params.count,
        resolution: params.resolution,
        videoResolution: params.videoResolution,
        aspectRatio: params.aspectRatio,
        referenceUrls: params.referenceUrls,
        videoReferences: params.videoReferences,
        smartMultiShots: params.smartMultiShots,
        referenceMode: params.referenceMode,
        durationSec: params.durationSec,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`视频 API 错误 (${res.status}): ${text.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      urls?: string[];
      output?: string | string[];
    };

    let urls: string[] = [];
    if (Array.isArray(json.urls)) urls = json.urls;
    else if (typeof json.output === "string") urls = [json.output];
    else if (Array.isArray(json.output)) urls = json.output;

    if (!urls.length) {
      throw new Error("视频 API 未返回有效 URL");
    }

    return { urls: urls.slice(0, params.count), provider: "http" };
  },
};
