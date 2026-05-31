/**
 * 火山方舟 Seedream 图生图 provider
 *
 * 用于普通图生图场景（非工具），支持参考图片生成。
 * 火山方舟 Seedream API 与 OpenAI Images API 形态兼容：
 *   POST {ARK_BASE_URL}/images/generations
 *   Body: { model, prompt, image, size, n, response_format }
 *
 * 文档：https://www.volcengine.com/docs/82379 （火山方舟）
 */
import { resolveImageDimensions } from "../lib/image-size.js";
import type { GenerateParams, GenerateResult, ImageProvider } from "./types.js";

function resolveSeedreamSize(resolution: string, aspectRatio: string): string {
  const [w, h] = resolveImageDimensions(resolution, aspectRatio);
  const cap = 4096;
  let cw = Math.min(w, cap);
  let ch = Math.min(h, cap);
  const MIN_PIXELS = 3_686_400;
  while (cw * ch < MIN_PIXELS && (cw < cap || ch < cap)) {
    if (cw <= ch && cw < cap) cw = Math.min(cap, Math.ceil(cw * 1.25));
    else if (ch < cap) ch = Math.min(cap, Math.ceil(ch * 1.25));
    else break;
  }
  return `${cw}x${ch}`;
}

interface SeedreamApiResponse {
  data?: { url?: string; b64_json?: string }[];
  error?: { message?: string };
}

const SUPPORTED_MODELS = new Set([
  "omni-v2",
  "latest-v2-pro",
  "seedream-5",
  "seedream-4",
]);

export const seedreamImageProvider: ImageProvider = {
  name: "seedream-image",
  supports(modelId: string) {
    if (!process.env.ARK_API_KEY?.trim()) return false;
    return SUPPORTED_MODELS.has(modelId);
  },
  async generate(params: GenerateParams): Promise<GenerateResult> {
    const apiKey = process.env.ARK_API_KEY?.trim();
    if (!apiKey) throw new Error("ARK_API_KEY 未配置");

    const base = (
      process.env.ARK_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3"
    ).replace(/\/$/, "");
    const model = process.env.SEEDREAM_MODEL ?? "doubao-seedream-5-0-260128";
    const size = resolveSeedreamSize(params.resolution, params.aspectRatio ?? "1:1");

    const body: Record<string, unknown> = {
      model,
      prompt: params.prompt.slice(0, 4000),
      size,
      n: Math.min(params.count, 4),
      response_format: "url",
    };

    if (params.referenceUrls?.length) {
      body.image = params.referenceUrls[0];
    }

    const res = await fetch(`${base}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `火山方舟 Seedream 失败 (${res.status}): ${errText.slice(0, 300)}`,
      );
    }

    const json = (await res.json()) as SeedreamApiResponse;
    if (json.error) {
      throw new Error(`Seedream 业务错误：${json.error.message ?? ""}`);
    }

    const urls = (json.data ?? [])
      .map((it) => it.url)
      .filter((u): u is string => typeof u === "string" && u.length > 0);

    if (urls.length === 0) {
      throw new Error("Seedream 返回缺少图片 URL");
    }

    return { urls, provider: "seedream-image" };
  },
};