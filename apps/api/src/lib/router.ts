import { userHasByokOpenAi } from "./user-provider-config.js";

export interface RouteSuggestion {
  modelId: string;
  reason: string;
}

const ECOMMERCE_KEYWORDS = ["电商", "主图", "详情", "海报", "商品", "淘宝", "京东"];
const PORTRAIT_KEYWORDS = ["人像", "证件照", "头像", "肤色", "美颜"];
const QUICK_KEYWORDS = ["快速", "简单", "换背景"];

function aliyunWanI2iConfigured(): boolean {
  return Boolean(process.env.ALIYUN_WAN_I2I_MODEL?.trim());
}

export function suggestModel(
  mode: string,
  prompt: string,
  hasReferenceImages?: boolean,
  userId?: string,
): RouteSuggestion {
  if (userId && userHasByokOpenAi(userId) && !hasReferenceImages) {
    return {
      modelId: "dall-e-3",
      reason: "已启用 BYOK，将使用您的 OpenAI Key 出图",
    };
  }

  if (hasReferenceImages) {
    const hasSeedream = Boolean(process.env.ARK_API_KEY?.trim());
    const hasWan = Boolean(process.env.DASHSCOPE_API_KEY?.trim());
    
    if (hasSeedream) {
      return {
        modelId: "seedream-5",
        reason: "检测到参考图片，使用火山方舟 Seedream 进行图生图",
      };
    }
    
    if (hasWan && aliyunWanI2iConfigured()) {
      return {
        modelId: "latest-v2-pro",
        reason: "检测到参考图片，使用阿里云万相图生图模型",
      };
    }

    if (hasWan) {
      return {
        modelId: "omni-v2",
        reason:
          "⚠️ 已配置万相文生图但未配置 ALIYUN_WAN_I2I_MODEL；图生图请配置 ARK_API_KEY（Seedream）或万相 i2i 模型",
      };
    }
    
    return {
      modelId: "omni-v2",
      reason: "⚠️ 您引用了图片但未配置图生图 API（ARK_API_KEY 或 DASHSCOPE_API_KEY），将走文生图流程。建议配置 API key 以获得更好的图生图效果。",
    };
  }

  if (mode === "ecommerce") {
    return {
      modelId: "latest-v2-pro",
      reason: "电商套图场景，优先稳定 Pro 模型",
    };
  }

  if (mode === "image") {
    return {
      modelId: "omni-v2",
      reason: "图片模式，按当前图片生成偏好出图",
    };
  }

  if (ECOMMERCE_KEYWORDS.some((k) => prompt.includes(k))) {
    return {
      modelId: "latest-v2-pro",
      reason: "检测到电商类需求",
    };
  }

  if (PORTRAIT_KEYWORDS.some((k) => prompt.includes(k))) {
    return {
      modelId: "seedream-5",
      reason: "检测到人像类需求，强化一致性",
    };
  }

  if (QUICK_KEYWORDS.some((k) => prompt.includes(k))) {
    return {
      modelId: "omni-v2",
      reason: "检测到轻量编辑需求",
    };
  }

  return {
    modelId: "omni-v2",
    reason: "默认通用对话模型",
  };
}
