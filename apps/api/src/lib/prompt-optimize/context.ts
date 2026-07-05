import type { OptimizeMode, PromptOptimizeContext } from "./types.js";

const BASE_SYSTEM: Record<OptimizeMode, string> = {
  chat:
    "你是 AI 绘画提示词专家。将用户的简短描述扩写为中文提示词：保留原意，补充主体、场景、光影、材质与风格，适合文生图。只输出提示词正文，不要解释。",
  image:
    "你是图片模式提示词助手。将用户输入改写为清晰完整的中文绘画提示词，突出主体、构图、光影、材质与风格。只输出提示词正文。",
  ecommerce:
    "你是电商视觉提示词专家。将用户描述改写为适合淘宝/京东主图与详情的中文提示词：突出卖点、干净背景或场景、商业摄影质感。只输出提示词正文。",
};

/** 意图专家画像：按 intentSignal 索引，驱动场景化的系统提示词 */
interface IntentPersona {
  /** 中文方向标签，用于 UI 展示 */
  label: string;
  /** 专家身份定位 */
  persona: string;
  /** 需覆盖的结构化维度 */
  dimensions: string[];
  /** 该场景硬约束 */
  constraints: string[];
  /** 该场景负面提示（可选） */
  negatives?: string;
}

const INTENT_PERSONA: Record<string, IntentPersona> = {
  "image-generate": {
    label: "文生图",
    persona: "你是资深文生图提示词专家。",
    dimensions: ["主体", "场景/背景", "光影", "材质/质感", "构图/视角", "风格"],
    constraints: ["保留用户原意", "补全缺失维度但不臆造关键主体"],
  },
  "image-edit": {
    label: "局部编辑",
    persona: "你是图像局部编辑提示词专家。",
    dimensions: ["编辑目标区域", "改动前后差异", "需保持不变的部分"],
    constraints: ["仅修改用户指定区域", "保持主体、光影、风格一致", "不要整体重画"],
    negatives: "避免改变未提及的区域、避免主体走形",
  },
  "image-expand": {
    label: "扩图",
    persona: "你是扩图（outpaint）提示词专家。",
    dimensions: ["向外延展的环境内容", "透视延续", "光源方向延续"],
    constraints: ["保持与原图透视/光影连续", "主体不变形", "接缝自然"],
  },
  "image-enhance": {
    label: "超清增强",
    persona: "你是画质增强提示词专家。",
    dimensions: ["清晰度", "细节", "质感"],
    constraints: ["保持原构图与语义", "只提升画质不改内容"],
  },
  "image-cutout": {
    label: "抠图",
    persona: "你是抠图提示词专家。",
    dimensions: ["主体边界", "alpha 干净度", "发丝/边缘细节"],
    constraints: ["精确主体边界", "背景干净透明"],
  },
  "image-erase": {
    label: "消除",
    persona: "你是物体消除提示词专家。",
    dimensions: ["待消除对象", "背景补全策略"],
    constraints: ["彻底移除目标", "背景无痕补全"],
  },
  "image-text": {
    label: "文字编辑",
    persona: "你是图像文字编辑提示词专家。",
    dimensions: ["目标文字内容", "字体/风格", "位置"],
    constraints: ["精确文字内容", "其余画面不变"],
  },
  "image-variation": {
    label: "变体",
    persona: "你是图像变体提示词专家。",
    dimensions: ["保留的风格骨架", "变化维度(姿态/角度/配色)"],
    constraints: ["保留原风格调性", "仅做可控变化"],
  },
  "video-generate": {
    label: "文生视频",
    persona: "你是文生视频提示词专家。",
    dimensions: ["主体动作", "镜头运动", "时长/节奏", "氛围"],
    constraints: ["描述可执行的镜头语言", "动作连贯"],
  },
  "video-from-image": {
    label: "图生视频",
    persona: "你是图生视频提示词专家。",
    dimensions: ["镜头运动幅度", "首尾帧一致性", "运动主体"],
    constraints: ["保持首帧主体一致", "避免主体漂移", "运动自然"],
  },
  "video-edit": {
    label: "视频编辑",
    persona: "你是视频编辑提示词专家。",
    dimensions: ["编辑段落", "目标效果"],
    constraints: ["明确编辑范围", "风格连续"],
  },
};

/** mode → 默认意图信号（无 intentSignal 时的回退） */
const MODE_DEFAULT_SIGNAL: Record<OptimizeMode, string> = {
  chat: "image-generate",
  image: "image-generate",
  ecommerce: "ecommerce",
};

/** 解析最终意图方向：优先 context.intentSignal，回退 mode 默认信号 */
export function resolveDirection(
  mode: OptimizeMode,
  context?: PromptOptimizeContext,
): { direction: string; label: string } {
  const signal = context?.intentSignal;
  if (signal && INTENT_PERSONA[signal]) {
    return { direction: signal, label: INTENT_PERSONA[signal].label };
  }
  const fallback = MODE_DEFAULT_SIGNAL[mode];
  const label =
    mode === "ecommerce" ? "电商视觉" : INTENT_PERSONA[fallback]?.label ?? "文生图";
  return { direction: fallback, label };
}

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

/** 去重并过滤空白候选，保持顺序 */
export function dedupeCandidates(candidates: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const c of candidates) {
    const trimmed = c.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

/** 基于意图画像构建场景化的专家指令块 */
function buildPersonaBlock(signal: string): string | null {
  const persona = INTENT_PERSONA[signal];
  if (!persona) return null;
  const lines = [persona.persona];
  lines.push(`需覆盖维度：${persona.dimensions.join("、")}。`);
  lines.push(`硬约束：${persona.constraints.join("；")}。`);
  if (persona.negatives) {
    lines.push(`需规避：${persona.negatives}。`);
  }
  lines.push("只输出提示词正文，不要解释。");
  return lines.join("\n");
}

export function buildOptimizeSystemPrompt(
  mode: OptimizeMode,
  context?: PromptOptimizeContext,
): string {
  const ctx = context ?? {};

  // 意图条件化：命中意图画像时用场景专家指令，否则回退通用 BASE_SYSTEM
  const signal = ctx.intentSignal;
  const personaBlock =
    signal && signal !== "ecommerce" ? buildPersonaBlock(signal) : null;
  const parts = [personaBlock ?? BASE_SYSTEM[mode]];

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
