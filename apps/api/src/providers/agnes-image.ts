/**
 * Agnes Image 2.1 Flash — OpenAI 兼容 /v1/images/generations
 * 文档：https://agnes-ai.com/doc/agnes-image-21-flash
 */
import { resolveImageDimensions } from "../lib/image-size.js";
import type { GenerateParams, GenerateResult, ImageProvider } from "./types.js";

export const AGNES_IMAGE_MODEL_ID = "agnes-image";

const ROUTING_ALIASES = new Set([
  AGNES_IMAGE_MODEL_ID,
  "agnes-image-2.1-flash",
  "omni-v2",
  "latest-v2-pro",
]);

function agnesImageApiModel(): string {
  return process.env.AGNES_IMAGE_MODEL?.trim() || "agnes-image-2.1-flash";
}

function resolveAgnesSize(resolution: string, aspectRatio: string): string {
  const [w, h] = resolveImageDimensions(resolution, aspectRatio);
  return `${w}x${h}`;
}

export function agnesImageConfigured(): boolean {
  return Boolean(process.env.AGNES_API_KEY?.trim());
}

interface AgnesImageResponse {
  data?: { url?: string }[];
  error?: { message?: string };
}

export const agnesImageProvider: ImageProvider = {
  name: "agnes-image",
  supports(modelId, operation) {
    if (!agnesImageConfigured()) return false;
    if (operation === "edit" || operation === "variation") return false;
    return ROUTING_ALIASES.has(modelId);
  },
  async generate(params: GenerateParams): Promise<GenerateResult> {
    const apiKey = process.env.AGNES_API_KEY?.trim();
    if (!apiKey) throw new Error("AGNES_API_KEY 未配置");

    const base = (
      process.env.AGNES_API_BASE_URL ?? "https://apihub.agnes-ai.com/v1"
    ).replace(/\/$/, "");
    const refs = params.referenceUrls ?? [];
    const body: Record<string, unknown> = {
      model: agnesImageApiModel(),
      prompt: params.prompt.slice(0, 4000),
      size: resolveAgnesSize(params.resolution, params.aspectRatio ?? "1:1"),
      n: Math.min(params.count, 4),
    };
    if (refs.length) {
      body.extra_body = {
        image: refs.length === 1 ? refs[0] : refs,
        response_format: "url",
      };
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
      throw new Error(`Agnes Image 失败 (${res.status}): ${errText.slice(0, 300)}`);
    }

    const json = (await res.json()) as AgnesImageResponse;
    if (json.error?.message) {
      throw new Error(`Agnes Image 业务错误：${json.error.message}`);
    }

    const urls = (json.data ?? [])
      .map((it) => it.url)
      .filter((u): u is string => typeof u === "string" && u.length > 0);

    if (!urls.length) {
      throw new Error("Agnes Image 返回缺少图片 URL");
    }

    return { urls, provider: "agnes-image" };
  },
};
