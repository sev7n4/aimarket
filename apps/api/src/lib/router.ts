export interface RouteSuggestion {
  modelId: string;
  reason: string;
}

const ECOMMERCE_KEYWORDS = ["电商", "主图", "详情", "海报", "商品", "淘宝", "京东"];
const PORTRAIT_KEYWORDS = ["人像", "证件照", "头像", "肤色", "美颜"];
const QUICK_KEYWORDS = ["快速", "简单", "换背景"];

export function suggestModel(
  mode: string,
  prompt: string,
): RouteSuggestion {
  if (mode === "ecommerce") {
    return {
      modelId: "latest-v2-pro",
      reason: "电商套图场景，优先稳定 Pro 模型",
    };
  }

  if (mode === "quick") {
    return {
      modelId: "omni-v2",
      reason: "快速模式，优先速度与性价比",
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
