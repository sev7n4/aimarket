/**
 * 火山方舟 Seedream 5 Studio 工具 provider
 *
 * 一个 provider 通过 prompt 指令复用覆盖 5 类工具：
 *   - cutout    抠图（"保留主体并生成透明背景 PNG"）
 *   - upscale   超分（"无损放大 2x/4x，保留细节"）
 *   - enhance   增强（"提升清晰度、对比与色彩"）
 *   - expand    扩图（"向四周延展场景，保持主体不变"）
 *   - inpaint   局部修改（按用户 prompt 重绘）
 *
 * 火山方舟 Seedream API 与 OpenAI Images API 形态兼容：
 *   POST {ARK_BASE_URL}/images/generations
 *   Body: { model, prompt, image, size, n, response_format }
 *
 * 文档：https://www.volcengine.com/docs/82379 （火山方舟）
 */
import { resolveImageDimensions } from "../../lib/image-size.js";
import type { ImageToolProvider, ToolRunParams, ToolRunResult } from "./types.js";

const SUPPORTED_TOOL_IDS = new Set([
  "cutout",
  "upscale",
  "enhance",
  "erase",
  "expand",
  "inpaint",
]);

function isSeedreamConfigured(): boolean {
  return Boolean(process.env.ARK_API_KEY?.trim());
}

function resolveMode(toolId: string): "seedream" | "mock" | "auto" | "http" {
  let envKey: string;
  if (toolId === "cutout") envKey = "TOOL_CUTOUT_PROVIDER";
  else if (toolId === "upscale" || toolId === "enhance")
    envKey = "TOOL_UPSCALE_PROVIDER";
  else envKey = "TOOL_EDIT_PROVIDER";
  const raw = (process.env[envKey] ?? "auto").toLowerCase();
  if (raw === "seedream" || raw === "mock" || raw === "http") return raw;
  return "auto";
}

/** auto 模式下：有 ARK_API_KEY 才认这个 provider */
export function shouldUseSeedream(toolId: string): boolean {
  const mode = resolveMode(toolId);
  if (mode === "mock" || mode === "http") return false;
  if (mode === "seedream") return true;
  return isSeedreamConfigured();
}

/** expand 默认 21:9；inpaint/cutout/upscale 保留原比例 */
function resolveAspect(params: ToolRunParams): string {
  if (params.toolId === "expand") return "21:9";
  return params.aspectRatio ?? "1:1";
}

function resolveSize(params: ToolRunParams): string {
  const factor =
    params.toolId === "upscale"
      ? /4\s*[xX倍]/.test(params.prompt) ? 4 : 2
      : params.toolId === "enhance"
        ? 1
        : 1;
  const [w, h] = resolveImageDimensions(params.resolution, resolveAspect(params));
  const cap = 4096;
  let cw = Math.min(w * factor, cap);
  let ch = Math.min(h * factor, cap);
  /** 火山 Seedream 要求至少 3686400 像素（约 1920×1920） */
  const MIN_PIXELS = 3_686_400;
  while (cw * ch < MIN_PIXELS && (cw < cap || ch < cap)) {
    if (cw <= ch && cw < cap) cw = Math.min(cap, Math.ceil(cw * 1.25));
    else if (ch < cap) ch = Math.min(cap, Math.ceil(ch * 1.25));
    else break;
  }
  return `${cw}x${ch}`;
}

function buildPrompt(params: ToolRunParams): string {
  const userPrompt = (params.prompt ?? "").trim();
  switch (params.toolId) {
    case "cutout":
      return `保留图像主体物，去除全部背景，输出干净的透明背景 PNG，边缘需精细抗锯齿。${userPrompt}`;
    case "upscale": {
      const factor = /4\s*[xX倍]/.test(userPrompt) ? "4 倍" : "2 倍";
      return `对图像进行无损${factor}放大超分，保留并增强细节纹理，不改变主体内容。${userPrompt}`;
    }
    case "enhance":
      return `提升图像清晰度、对比度与色彩饱和度，修复细节，不改变主体内容。${userPrompt}`;
    case "expand":
      return `向四周智能扩展画面，保持原主体与光影一致，自然延展场景。${userPrompt || "横向 21:9 扩图"}`;
    case "erase":
      return `根据 mask 区域智能消除多余元素，并自然补全背景。${userPrompt || "去除圈选区域内容"}`;
    case "inpaint":
      return userPrompt || "按上下文进行自然局部重绘";
    default:
      return userPrompt;
  }
}

interface SeedreamApiResponse {
  data?: { url?: string; b64_json?: string }[];
  error?: { message?: string };
}

export const seedreamToolProvider: ImageToolProvider = {
  name: "tool-seedream",
  supports(toolId: string) {
    return SUPPORTED_TOOL_IDS.has(toolId) && shouldUseSeedream(toolId);
  },
  async run(params: ToolRunParams): Promise<ToolRunResult> {
    const apiKey = process.env.ARK_API_KEY?.trim();
    if (!apiKey) throw new Error("ARK_API_KEY 未配置");

    const base = (
      process.env.ARK_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3"
    ).replace(/\/$/, "");
    const model = process.env.SEEDREAM_MODEL ?? "doubao-seedream-5-0-260128";

    const body: Record<string, unknown> = {
      model,
      prompt: buildPrompt(params),
      size: resolveSize(params),
      n: Math.min(params.count ?? 1, 4),
      response_format: "url",
    };
    if (params.referenceUrls.length > 0) {
      body.image = params.referenceUrls[0];
    }
    if (params.toolContext?.masks.length) {
      // 兼容自建/未来官方局部编辑网关：同时传 mask 图和归一化 bbox。
      body.mask = params.toolContext.masks[0].maskDataUrl;
      body.mask_bbox = params.toolContext.masks[0].normalizedBbox;
      body.mask_mode = params.toolContext.masks[0].mode;
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

    const isCutout = params.toolId === "cutout";
    return {
      urls,
      provider: "tool-seedream",
      mimeType: isCutout ? "image/png" : "image/jpeg",
      variant: params.toolId === "expand" || params.toolId === "inpaint"
        ? params.toolId
        : undefined,
      scale:
        params.toolId === "upscale"
          ? /4\s*[xX倍]/.test(params.prompt) ? "4x" : "2x"
          : params.toolId === "enhance"
            ? "1x"
            : undefined,
    };
  },
};
