import { agnesImageConfigured } from "../providers/agnes-image.js";
import type {
  GenerationQualityTier,
  GenerationRoutingMode,
} from "./generation-routing.js";
import {
  LEGACY_PRO_MODEL_ID,
  LEGACY_STANDARD_MODEL_ID,
  qualityTierToLegacyModelId,
} from "./generation-routing.js";
import { userHasByokOpenAi } from "./user-provider-config.js";

export interface RouteSuggestion {
  routingMode: GenerationRoutingMode;
  qualityTier: GenerationQualityTier;
  /** 兼容积分估算与 Provider 绑定；新逻辑请读 routingMode + qualityTier */
  modelId: string;
  reason: string;
}

const ECOMMERCE_KEYWORDS = ["电商", "主图", "详情", "海报", "商品", "淘宝", "京东"];
const PORTRAIT_KEYWORDS = ["人像", "证件照", "头像", "肤色", "美颜"];
const QUICK_KEYWORDS = ["快速", "简单", "换背景"];

function aliyunWanI2iConfigured(): boolean {
  return Boolean(process.env.ALIYUN_WAN_I2I_MODEL?.trim());
}

function anyI2iProviderConfigured(): boolean {
  return (
    agnesImageConfigured() ||
    (Boolean(process.env.DASHSCOPE_API_KEY?.trim()) &&
      aliyunWanI2iConfigured()) ||
    Boolean(process.env.ARK_API_KEY?.trim())
  );
}

function autoSuggestion(
  tier: GenerationQualityTier,
  reason: string,
): RouteSuggestion {
  return {
    routingMode: "auto",
    qualityTier: tier,
    modelId: qualityTierToLegacyModelId(tier),
    reason,
  };
}

export function suggestModel(
  mode: string,
  prompt: string,
  hasReferenceImages?: boolean,
  userId?: string,
): RouteSuggestion {
  if (userId && userHasByokOpenAi(userId) && !hasReferenceImages) {
    return {
      routingMode: "byok",
      qualityTier: "standard",
      modelId: "dall-e-3",
      reason: "已启用 BYOK，将使用您的 OpenAI Key 出图",
    };
  }

  if (hasReferenceImages) {
    if (anyI2iProviderConfigured()) {
      return autoSuggestion(
        "pro",
        "检测到参考图片，Auto 将按 Agnes → 万相 → Seedream 依次尝试",
      );
    }

    const hasWan = Boolean(process.env.DASHSCOPE_API_KEY?.trim());
    if (hasWan) {
      return autoSuggestion(
        "standard",
        "⚠️ 已配置万相文生图但未配置图生图能力；请配置 AGNES_API_KEY、ALIYUN_WAN_I2I_MODEL 或 ARK_API_KEY",
      );
    }

    return autoSuggestion(
      "standard",
      "⚠️ 您引用了图片但未配置图生图 API，将走文生图流程。建议配置 API key 以获得更好的图生图效果。",
    );
  }

  if (mode === "ecommerce") {
    return autoSuggestion(
      "pro",
      "电商套图场景，Auto 将按 Agnes → 万相 → Seedream 依次尝试",
    );
  }

  if (mode === "image") {
    return autoSuggestion(
      "standard",
      "图片模式，Auto 将按 Agnes → 万相 → Seedream 依次尝试",
    );
  }

  if (ECOMMERCE_KEYWORDS.some((k) => prompt.includes(k))) {
    return autoSuggestion(
      "pro",
      "检测到电商类需求，Auto 将按 Agnes → 万相 → Seedream 依次尝试",
    );
  }

  if (PORTRAIT_KEYWORDS.some((k) => prompt.includes(k))) {
    return autoSuggestion(
      "pro",
      "检测到人像类需求，Auto 将按 Agnes → 万相 → Seedream 依次尝试",
    );
  }

  if (QUICK_KEYWORDS.some((k) => prompt.includes(k))) {
    return autoSuggestion(
      "standard",
      "检测到轻量编辑需求，Auto 将按 Agnes → 万相 → Seedream 依次尝试",
    );
  }

  return autoSuggestion(
    "standard",
    "默认通用模型，Auto 将按 Agnes → 万相 → Seedream 依次尝试",
  );
}

/** 供测试与文档引用 */
export const LEGACY_AUTO_MODEL_IDS = {
  standard: LEGACY_STANDARD_MODEL_ID,
  pro: LEGACY_PRO_MODEL_ID,
} as const;
