import type { CreationLane } from "./creation-dock-prefs";

/** 提交路径类型（由 creation-lane-submit.ts 产出） */
export type SubmitPath =
  | "orchestration"
  | "skill"
  | "agent"
  | "focus-edit"
  | "image-or-video";

// ─── 类型定义 ────────────────────────────────────────────────────────────────

/** 意图信号枚举：描述用户可能表达的创作意图类型 */
export type IntentSignal =
  | "image-generate"       // 纯文生图
  | "image-edit"           // 图片编辑（含局部修改）
  | "image-expand"         // 扩图
  | "image-enhance"        // 增强/超清
  | "image-variation"      // 变体
  | "image-cutout"         // 抠图
  | "image-erase"          // 消除
  | "image-text"           // 改字
  | "video-generate"       // 文生视频
  | "video-from-image"     // 图生视频
  | "video-edit"           // 视频编辑
  | "agent-plan"           // Agent 规划执行
  | "skill-pipeline"       // Skill 流水线
  | "composite"            // 跨模态复合意图
  | "unknown";

/** 完整意图分析结果 */
export interface IntentAnalysis {
  /** 主意图信号 */
  primarySignal: IntentSignal;
  /** 所有检测到的信号（含复合意图） */
  signals: IntentSignal[];
  /** 推荐的提交路径 */
  recommendedPath: SubmitPath;
  /** 推荐的工具 ID 列表（按优先级） */
  recommendedTools: string[];
  /** 是否为跨模态复合意图 */
  isComposite: boolean;
  /** 推荐的视频参考模式（仅视频相关意图） */
  videoReferenceMode?: "omni" | "first-last" | "smart-multi-frame";
  /** 推理置信度 0-1 */
  confidence: number;
}

/** 意图路由输入 */
export interface IntentRouterInput {
  prompt: string;
  creationLane: CreationLane;
  activeSkillId: string | null;
  focusEditActive: boolean;
  mentionedMasksCount: number;
  submitVideo: boolean;
  hasReferenceImages: boolean;
  hasSelectedCanvasItem: boolean;
  /** Skills 是否启用 */
  skillsEnabled: boolean;
  /** Agent 是否启用 */
  agentEnabled: boolean;
  /** 是否 Dock 模式 */
  isDock: boolean;
}

// ─── 关键词映射表 ────────────────────────────────────────────────────────────

/** 关键词到意图信号的映射（中英文，大小写不敏感） */
const KEYWORD_SIGNAL_MAP: Array<{ patterns: RegExp; signal: IntentSignal }> = [
  // 视频生成
  {
    patterns: /(?:生成视频|做视频|变成视频|转视频|制作视频|generate\s+video|make\s+video|create\s+video|text\s+to\s+video)/i,
    signal: "video-generate",
  },
  // 图生视频（需配合 hasReferenceImages 修正）
  {
    patterns: /(?:图生视频|图片转视频|图片做视频|image\s+to\s+video|img\s+to\s+video)/i,
    signal: "video-from-image",
  },
  // 视频编辑
  {
    patterns: /(?:编辑视频|修改视频|剪辑视频|edit\s+video|modify\s+video)/i,
    signal: "video-edit",
  },
  // 图片编辑（替换/修改）
  {
    patterns: /(?:换成|替换|改成|变[成为]|修改|替换成|replace|change\s+to|swap|turn\s+into)/i,
    signal: "image-edit",
  },
  // 扩图
  {
    patterns: /(?:扩展|扩图|放大画布|outpaint|expand\s+canvas|extend)/i,
    signal: "image-expand",
  },
  // 增强/超清
  {
    patterns: /(?:变清晰|超清|高清|提升分辨率|增强画质|upscale|enhance|hd|super\s+resolution|improve\s+quality)/i,
    signal: "image-enhance",
  },
  // 消除
  {
    patterns: /(?:消除|去掉|删除|擦除|移除|移走|remove|erase|delete|clean)/i,
    signal: "image-erase",
  },
  // 抠图
  {
    patterns: /(?:抠图|去背|去背景|抠出|cutout|remove\s+background|segment)/i,
    signal: "image-cutout",
  },
  // 改字
  {
    patterns: /(?:改字|换字|改文字|换文字|修改文字|编辑文字|edit\s+text|change\s+text|replace\s+text)/i,
    signal: "image-text",
  },
  // 变体
  {
    patterns: /(?:变体|类似|风格一样|相似|variation|similar\s+style|same\s+style)/i,
    signal: "image-variation",
  },
  // Agent 规划
  {
    patterns: /(?:帮我|自动|一键|help\s+me|auto|one.?click)/i,
    signal: "agent-plan",
  },
];

// ─── 意图信号提取 ────────────────────────────────────────────────────────────

/** 基于用户输入的 prompt 提取意图信号列表 */
function extractSignalsFromPrompt(prompt: string): IntentSignal[] {
  if (!prompt || !prompt.trim()) return [];

  const signals: IntentSignal[] = [];

  for (const { patterns, signal } of KEYWORD_SIGNAL_MAP) {
    if (patterns.test(prompt)) {
      signals.push(signal);
    }
  }

  return signals;
}

// ─── 画布上下文修正 ──────────────────────────────────────────────────────────

/** 结合画布上下文信息修正意图信号 */
function refineSignalsWithContext(
  signals: IntentSignal[],
  input: IntentRouterInput,
): IntentSignal[] {
  const refined = [...signals];

  // focus-edit 激活或有 mask 提及 → 修正为 image-edit
  if (
    (input.focusEditActive || input.mentionedMasksCount > 0) &&
    !refined.includes("image-edit")
  ) {
    refined.unshift("image-edit");
  }

  // 有参考图 + 视频关键词 → 修正为 video-from-image
  if (
    input.hasReferenceImages &&
    refined.includes("video-generate") &&
    !refined.includes("video-from-image")
  ) {
    const idx = refined.indexOf("video-generate");
    refined[idx] = "video-from-image";
  }

  // 激活 Skill → 追加 skill-pipeline
  if (input.activeSkillId && !refined.includes("skill-pipeline")) {
    refined.push("skill-pipeline");
  }

  // 选中画布元素 + 替换类关键词 → image-edit
  if (
    input.hasSelectedCanvasItem &&
    signals.includes("image-edit") &&
    !refined.includes("image-edit")
  ) {
    refined.unshift("image-edit");
  }

  return refined;
}

// ─── 复合意图检测 ────────────────────────────────────────────────────────────

/** 检测信号列表中是否包含跨模态复合意图 */
function detectCompositeIntent(signals: IntentSignal[]): boolean {
  const imageSignals: Set<IntentSignal> = new Set<IntentSignal>([
    "image-edit",
    "image-expand",
    "image-enhance",
    "image-variation",
    "image-cutout",
    "image-erase",
    "image-text",
    "image-generate",
  ]);
  const videoSignals: Set<IntentSignal> = new Set<IntentSignal>([
    "video-generate",
    "video-from-image",
    "video-edit",
  ]);

  const hasImage = signals.some((s) => imageSignals.has(s));
  const hasVideo = signals.some((s) => videoSignals.has(s));

  // 图片编辑 + 视频关键词 → 复合
  if (hasImage && hasVideo) return true;

  // 生成 + 编辑同现 → 复合
  const hasGenerate = signals.includes("image-generate");
  const hasEdit = signals.includes("image-edit");
  if (hasGenerate && hasEdit) return true;

  return false;
}

// ─── 推荐路径 ────────────────────────────────────────────────────────────────

/** 根据意图信号列表确定推荐的提交路径 */
function determineRecommendedPath(
  signals: IntentSignal[],
  isComposite: boolean,
  input: IntentRouterInput,
): SubmitPath {
  // 复合意图 → agent（让 Agent 规划多步）
  if (isComposite) return "agent";

  const primary = signals[0] ?? "unknown";

  // image-edit + focus-edit 激活 → focus-edit
  if (primary === "image-edit" && input.focusEditActive) return "focus-edit";

  // 视频相关意图 → image-or-video
  if (
    primary === "video-generate" ||
    primary === "video-from-image" ||
    primary === "video-edit"
  ) {
    return "image-or-video";
  }

  // skill-pipeline / agent-plan → skill 或 agent
  if (primary === "skill-pipeline") {
    return "skill";
  }

  if (primary === "agent-plan") {
    return "agent";
  }

  // 默认 → image-or-video
  return "image-or-video";
}

// ─── 推荐工具 ────────────────────────────────────────────────────────────────

/** 工具推荐映射表 */
const SIGNAL_TOOLS_MAP: Record<string, string[]> = {
  "image-edit": ["inpaint", "focus-edit"],
  "image-expand": ["expand"],
  "image-erase": ["erase"],
  "image-cutout": ["cutout"],
  "image-enhance": ["upscale", "enhance"],
  "image-text": ["text"],
  "image-variation": ["variation"],
  "image-generate": ["generate"],
  "video-generate": ["video"],
  "video-from-image": ["video"],
  "video-edit": ["video-edit"],
  "agent-plan": ["agent"],
  "skill-pipeline": ["skill"],
};

/** 根据意图信号列表生成推荐工具 ID（按优先级） */
function determineRecommendedTools(
  signals: IntentSignal[],
  isComposite: boolean,
): string[] {
  if (isComposite) {
    // 复合意图：按信号顺序组合工具，去重
    const tools: string[] = [];
    for (const signal of signals) {
      const signalTools = SIGNAL_TOOLS_MAP[signal];
      if (signalTools) {
        for (const t of signalTools) {
          if (!tools.includes(t)) tools.push(t);
        }
      }
    }
    return tools;
  }

  const primary = signals[0];
  return SIGNAL_TOOLS_MAP[primary] ?? [];
}

// ─── 视频参考模式 ────────────────────────────────────────────────────────────

/** 根据意图信号确定视频参考模式 */
function determineVideoReferenceMode(
  signals: IntentSignal[],
): "omni" | "first-last" | "smart-multi-frame" | undefined {
  if (signals.includes("video-from-image")) return "first-last";
  if (signals.includes("video-generate")) return undefined;
  if (signals.includes("video-edit")) return "omni";
  return undefined;
}

// ─── 置信度计算 ──────────────────────────────────────────────────────────────

/** 计算意图分析的置信度 */
function computeConfidence(
  signals: IntentSignal[],
  input: IntentRouterInput,
): number {
  if (signals.length === 0) {
    // 无信号时根据车道类型给基础置信度
    if (input.creationLane === "video") return 0.3;
    if (input.creationLane === "agent") return 0.3;
    return 0.4;
  }

  let confidence = 0.5;

  // 有上下文佐证则提升置信度
  if (input.focusEditActive && signals.includes("image-edit")) confidence += 0.2;
  if (input.hasReferenceImages && signals.includes("video-from-image")) confidence += 0.2;
  if (input.activeSkillId && signals.includes("skill-pipeline")) confidence += 0.2;
  if (input.submitVideo && (signals.includes("video-generate") || signals.includes("video-from-image"))) confidence += 0.15;
  if (input.hasSelectedCanvasItem && signals.includes("image-edit")) confidence += 0.1;

  // 信号越多但无复合佐证 → 略微降低
  if (signals.length > 2 && !detectCompositeIntent(signals)) confidence -= 0.05;

  return Math.min(Math.max(confidence, 0), 1);
}

// ─── 核心函数 ────────────────────────────────────────────────────────────────

/**
 * 意图解析核心函数：基于 prompt 关键词与画布上下文，产出完整的意图分析结果
 *
 * 步骤：
 * 1. 基于 prompt 关键词提取意图信号
 * 2. 结合画布上下文修正信号
 * 3. 检测跨模态复合意图
 * 4. 确定推荐提交路径
 * 5. 生成推荐工具列表
 */
export function resolveIntent(input: IntentRouterInput): IntentAnalysis {
  // 步骤1：关键词提取
  const rawSignals = extractSignalsFromPrompt(input.prompt);

  // 步骤2：上下文修正
  const signals = refineSignalsWithContext(rawSignals, input);

  // 无信号时根据车道推断默认
  if (signals.length === 0) {
    const defaultSignal: IntentSignal =
      input.creationLane === "video"
        ? "video-generate"
        : input.creationLane === "agent"
          ? "agent-plan"
          : "image-generate";
    signals.push(defaultSignal);
  }

  // 步骤3：复合意图检测
  const isComposite = detectCompositeIntent(signals);
  if (isComposite && !signals.includes("composite")) {
    signals.push("composite");
  }

  // 主意图信号
  const primarySignal = isComposite ? "composite" : signals[0];

  // 步骤4：推荐路径
  const recommendedPath = determineRecommendedPath(signals, isComposite, input);

  // 步骤5：推荐工具
  const recommendedTools = determineRecommendedTools(
    isComposite ? signals.filter((s) => s !== "composite") : signals,
    isComposite,
  );

  // 视频参考模式
  const videoReferenceMode = determineVideoReferenceMode(signals);

  // 置信度
  const confidence = computeConfidence(signals, input);

  return {
    primarySignal,
    signals,
    recommendedPath,
    recommendedTools,
    isComposite,
    videoReferenceMode,
    confidence,
  };
}

/**
 * 增强路径解析：先用 resolveIntent 分析意图，再结合原有布尔守卫产出最终路径
 *
 * 优先级规则：
 * 1. 意图分析检测到复合意图 → 直接路由到 "agent"（绕过单路径布尔限制）
 * 2. 意图分析与布尔守卫一致 → 使用布尔守卫结果（保持向后兼容）
 * 3. 意图分析建议路径与布尔守卫不同但 confidence > 0.7 → 采用意图分析结果
 * 4. 否则保持布尔守卫结果
 */
export function enhanceSubmitPath(
  input: IntentRouterInput,
  booleanPath: SubmitPath,
): { path: SubmitPath; analysis: IntentAnalysis } {
  const analysis = resolveIntent(input);

  // 规则1：复合意图 → agent
  if (analysis.isComposite) {
    return { path: "agent", analysis };
  }

  // 规则2：一致 → 使用布尔守卫
  if (analysis.recommendedPath === booleanPath) {
    return { path: booleanPath, analysis };
  }

  // 规则3：不一致但置信度高 → 意图分析
  if (analysis.confidence > 0.7) {
    return { path: analysis.recommendedPath, analysis };
  }

  // 规则4：默认布尔守卫
  return { path: booleanPath, analysis };
}
