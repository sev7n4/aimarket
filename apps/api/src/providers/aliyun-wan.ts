/**
 * 阿里百炼 DashScope - 通义万相 wan2.6 文生图
 *
 * 端点：POST {DASHSCOPE_BASE_URL}/api/v1/services/aigc/multimodal-generation/generation
 * 鉴权：Authorization: Bearer ${DASHSCOPE_API_KEY}
 * 文档：https://www.alibabacloud.com/help/zh/model-studio/text-to-image-v2-api-reference
 *
 * 同步式接口：直接返回包含图片 URL 的响应（不是异步 task）。
 */
import { resolveImageDimensions } from "../lib/image-size.js";
import type { GenerateParams, GenerateResult, ImageProvider } from "./types.js";

/** wan2.6 支持的尺寸范围：512–1440 之间任意宽高，需 64 倍数 */
function resolveWanSize(resolution: string, aspectRatio: string): string {
  const [w, h] = resolveImageDimensions(resolution, aspectRatio);
  const clamp = (n: number) => {
    const rounded = Math.round(n / 64) * 64;
    return Math.max(512, Math.min(1440, rounded));
  };
  return `${clamp(w)}*${clamp(h)}`;
}

interface DashScopeContentItem {
  text?: string;
  image?: string;
}

interface DashScopeChoice {
  message?: {
    content?: DashScopeContentItem[];
  };
}

interface DashScopeResponse {
  output?: {
    choices?: DashScopeChoice[];
  };
  request_id?: string;
  code?: string;
  message?: string;
}

const SUPPORTED_MODELS = new Set([
  "omni-v2",
  "latest-v2-pro",
  "wanxiang-2.6",
  "wan2.6-t2i",
  "wan2.6-image",
  "wan2.5-t2i",
]);

/** 百炼图生图/编辑模型名（官方为 wan2.6-image，非 wan2.6-image-to-image） */
function resolveWanI2iModel(): string {
  const raw = process.env.ALIYUN_WAN_I2I_MODEL?.trim() || "wan2.6-image";
  if (raw === "wan2.6-image-to-image") return "wan2.6-image";
  return raw;
}

export const aliyunWanProvider: ImageProvider = {
  name: "aliyun-wan",
  supports(modelId: string, operation?: string) {
    if (!process.env.DASHSCOPE_API_KEY?.trim()) return false;
    if (operation === "edit" || operation === "variation") return false;
    return SUPPORTED_MODELS.has(modelId);
  },
  async generate(params: GenerateParams): Promise<GenerateResult> {
    const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
    if (!apiKey) throw new Error("DASHSCOPE_API_KEY 未配置");

    const base = (
      process.env.DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com"
    ).replace(/\/$/, "");
    const hasRefs = Boolean(params.referenceUrls?.length);
    const i2iModel = resolveWanI2iModel();
    const t2iModel = process.env.ALIYUN_WAN_MODEL ?? "wan2.6-t2i";
    if (hasRefs) {
      if (!i2iModel) {
        throw new Error(
          "ALIYUN_WAN_I2I_MODEL 未配置：万相 t2i 模型不支持参考图，请配置图生图模型或改用 Seedream",
        );
      }
    }
    const model = hasRefs ? i2iModel! : t2iModel;
    const size = resolveWanSize(params.resolution, params.aspectRatio ?? "1:1");

    const content: DashScopeContentItem[] = [];
    
    if (params.referenceUrls?.length) {
      for (const refUrl of params.referenceUrls) {
        content.push({ image: refUrl });
      }
    }
    
    content.push({ text: params.prompt.slice(0, 2000) });

    const res = await fetch(
      `${base}/api/v1/services/aigc/multimodal-generation/generation`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: {
            messages: [
              {
                role: "user",
                content,
              },
            ],
          },
          parameters: {
            size,
            n: Math.min(params.count, 4),
            watermark: false,
            prompt_extend: true,
          },
        }),
        signal: AbortSignal.timeout(180_000),
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `阿里百炼 wan API 失败 (${res.status}): ${errText.slice(0, 300)}`,
      );
    }

    const json = (await res.json()) as DashScopeResponse;
    if (json.code) {
      throw new Error(
        `阿里百炼 wan 业务错误 ${json.code}: ${json.message ?? ""}`,
      );
    }

    const imageUrls: string[] = [];
    for (const choice of json.output?.choices ?? []) {
      for (const item of choice.message?.content ?? []) {
        if (item.image) imageUrls.push(item.image);
      }
    }

    if (imageUrls.length === 0) {
      throw new Error("阿里百炼 wan 返回缺少图片 URL");
    }

    // 阿里 OSS 临时 URL 由上层 persistOutputUrls 统一持久化
    return { urls: imageUrls, provider: "aliyun-wan" };
  },
};
