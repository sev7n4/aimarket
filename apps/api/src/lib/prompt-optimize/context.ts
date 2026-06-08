import type { OptimizeMode, PromptOptimizeContext } from "./types.js";

const BASE_SYSTEM: Record<OptimizeMode, string> = {
  chat:
    "你是 AI 绘画提示词专家。将用户的简短描述扩写为中文提示词：保留原意，补充主体、场景、光影、材质与风格，适合文生图。只输出提示词正文，不要解释。",
  image:
    "你是图片模式提示词助手。将用户输入改写为清晰完整的中文绘画提示词，突出主体、构图、光影、材质与风格。只输出提示词正文。",
  ecommerce:
    "你是电商视觉提示词专家。将用户描述改写为适合淘宝/京东主图与详情的中文提示词：突出卖点、干净背景或场景、商业摄影质感。只输出提示词正文。",
};

function modelHint(modelId?: string): string {
  if (!modelId) return "";
  const id = modelId.toLowerCase();
  if (id.includes("seedream") || id.includes("doubao")) {
    return "目标模型偏好写实、细节清晰、中文语义准确。";
  }
  if (id.includes("agnes")) {
    return "目标模型偏好自然光影与人物肤质，避免过度夸张。";
  }
  if (id.includes("wan") || id.includes("aliyun")) {
    return "目标模型偏好干净构图与商业质感。";
  }
  return "";
}

function aspectHint(aspectRatio?: string): string {
  if (!aspectRatio || aspectRatio === "auto") return "";
  return `画面比例为 ${aspectRatio}，请在构图中体现该比例下的主体布局。`;
}

export function buildOptimizeSystemPrompt(
  mode: OptimizeMode,
  context?: PromptOptimizeContext,
): string {
  const parts = [BASE_SYSTEM[mode]];
  const ctx = context ?? {};

  if (ctx.hasReferenceImages) {
    parts.push(
      "用户已提供参考图：必须保持参考图中的主体与关键结构，仅按用户描述修改指定部分，不要凭空替换主体。",
    );
  }
  if (ctx.creationLane === "video") {
    parts.push("输出应适合短视频/动态镜头描述，可补充镜头运动与时长感。");
  }
  const mh = modelHint(ctx.modelId);
  if (mh) parts.push(mh);
  const ah = aspectHint(ctx.aspectRatio);
  if (ah) parts.push(ah);

  parts.push("输出长度不超过 600 字；只输出润色后的提示词正文。");
  return parts.join("\n");
}
