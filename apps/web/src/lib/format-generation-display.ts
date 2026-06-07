/** 与 API generation-routing 对齐 */
export type GenerationRoutingMode = "auto" | "explicit" | "byok";
export type GenerationQualityTier = "standard" | "pro";

/** @deprecated 读路径兼容；新数据请读 routingMode */
const INTERNAL_ROUTING_MODEL_IDS = new Set(["omni-v2", "latest-v2-pro"]);

const USER_MODEL_LABELS: Record<string, string> = {
  "seedream-5": "Seedream 5",
  "seedream-4": "Seedream 4",
  "wanxiang-2.6": "Wanxiang 2.6",
  "agnes-image": "Agnes Image 2.1",
  "dall-e-3": "DALL·E 3",
  "dall-e-2": "DALL·E 2",
};

const IMAGE_PROVIDER_LABELS: Record<string, string> = {
  "agnes-image": "Agnes Image",
  "aliyun-wan": "万相",
  "seedream-image": "Seedream",
  openai: "DALL·E",
  mock: "演示占位",
};

export interface GenerationBatchDisplayInput {
  modelId?: string;
  imageProvider?: string;
  /** 旧 job 兼容 */
  autoRoute?: boolean;
  routingMode?: GenerationRoutingMode;
  qualityTier?: GenerationQualityTier;
}

export function isInternalRoutingModelId(modelId?: string): boolean {
  return Boolean(modelId && INTERNAL_ROUTING_MODEL_IDS.has(modelId));
}

function isAutoRouting(params: GenerationBatchDisplayInput): boolean {
  if (params.routingMode === "auto" || params.routingMode === "byok") {
    return true;
  }
  if (params.routingMode === "explicit") return false;
  return (
    params.autoRoute === true || isInternalRoutingModelId(params.modelId)
  );
}

/** BYOK：Auto 无参考图时走用户 OpenAI Key，job 记为 dall-e-3 + openai */
export function isByokGeneration(params: GenerationBatchDisplayInput): boolean {
  if (params.routingMode === "byok") return true;
  return (
    params.modelId === "dall-e-3" && params.imageProvider === "openai"
  );
}

export function formatUserModelLabel(modelId?: string): string {
  if (!modelId) return "-";
  if (isInternalRoutingModelId(modelId)) return "Auto";
  return USER_MODEL_LABELS[modelId] ?? modelId;
}

export function formatImageProviderLabel(provider?: string): string | null {
  if (!provider) return null;
  return IMAGE_PROVIDER_LABELS[provider] ?? provider;
}

/**
 * 批次头「模型」行：用户选了什么（或 Auto / Auto BYOK）。
 * 不暴露 omni-v2 / latest-v2-pro 等内部 slug。
 */
export function formatBatchModelSelection(
  params: GenerationBatchDisplayInput,
): string {
  if (isByokGeneration(params)) return "Auto (BYOK)";
  if (isAutoRouting(params)) return "Auto";
  return formatUserModelLabel(params.modelId);
}

/**
 * 批次头「出图」行：实际调用的供应商。
 * - Auto 回落：展示 Agnes / 万相 / Seedream
 * - BYOK：强调「您的 Key」，与平台托管 OpenAI 区分（当前仅 BYOK 会落 dall-e-3+openai）
 * - 用户指定模型且与 provider 同品牌：返回 null（避免重复）
 */
export function formatBatchImageProvider(
  params: GenerationBatchDisplayInput,
): string | null {
  const provider = params.imageProvider;
  if (!provider) return null;

  if (isByokGeneration(params)) {
    return "DALL·E 3 · 您的 API Key";
  }

  const providerLabel = formatImageProviderLabel(provider);
  if (!providerLabel) return null;

  if (isAutoRouting(params)) return providerLabel;

  const modelId = params.modelId;
  if (modelId === "agnes-image" && provider === "agnes-image") return null;
  if (modelId === "wanxiang-2.6" && provider === "aliyun-wan") return null;
  if (
    (modelId === "seedream-5" || modelId === "seedream-4") &&
    provider === "seedream-image"
  ) {
    return null;
  }

  return providerLabel;
}
