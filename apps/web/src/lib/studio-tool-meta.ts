import type { StudioTool } from "@/lib/types";

const RESOLUTION_FACTOR: Record<string, number> = {
  "1k": 1,
  "2k": 1.5,
  "4k": 2,
};

const BASE_POINTS = 10;

/** 与 API estimateToolPoints 对齐：toolId × 分辨率 × 张数 */
export function estimateToolPointsClient(
  tool: Pick<StudioTool, "id" | "pricingFactor">,
  resolution: string,
  count = 1,
): number {
  const resFactor = RESOLUTION_FACTOR[resolution.toLowerCase()] ?? 1;
  const toolFactor = tool.pricingFactor ?? 1;
  const safeCount = Math.max(1, Math.min(4, count));
  return Math.max(1, Math.ceil(BASE_POINTS * resFactor * toolFactor * safeCount));
}

export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  variation: "变体",
  expand: "扩图",
  cutout: "抠图",
  inpaint: "局部修改",
  "focus-edit": "焦点编辑",
  erase: "消除",
  upscale: "超分",
  enhance: "增强",
  blend: "融合",
  crop: "裁剪",
  text: "改字",
  "grid-split": "宫格切分",
};

/** 画布工具条 / 批量条等紧凑 UI 的短标签 */
export const TOOL_SHORT_LABELS: Record<string, string> = {
  variation: "变体",
  expand: "扩图",
  erase: "消除",
  cutout: "抠图",
  inpaint: "局改",
  "focus-edit": "焦点",
  text: "改字",
  upscale: "超清",
  enhance: "变清",
  blend: "融合",
  crop: "裁剪",
  "grid-split": "切分",
};

export function toolShortLabel(toolId: string, fallback = toolId): string {
  return TOOL_SHORT_LABELS[toolId] ?? TOOL_DISPLAY_NAMES[toolId] ?? fallback;
}

export function toolDisplayName(toolId: string, fallback = toolId): string {
  return TOOL_DISPLAY_NAMES[toolId] ?? fallback;
}

/** 工具网格副文案：是否需要 prompt、张数、推荐路径等 */
export const TOOL_GRID_HINTS: Record<string, string> = {
  variation: "选图 · 1–4 张 · 同构图微差",
  expand: "真扩图 · 按比例扩边 · 可选方向",
  cutout: "选图 · 一键 · 推荐工具链",
  inpaint: "圈选 + prompt",
  "focus-edit": "点选 + prompt",
  erase: "圈选区域",
  upscale: "选图 · 2x/4x",
  enhance: "选图 · 一键",
  blend: "多图融合",
  text: "选图改字",
  "grid-split": "选图 · 2–5 行列",
};

export function formatToolProviderLabel(provider?: string | null): string {
  if (!provider) return "";
  const labels: Record<string, string> = {
    "tool-seedream": "Seedream 工具链",
    "tool-openai-variation": "OpenAI 变体",
    "tool-variation-mock": "Mock",
    "tool-openai-edit": "OpenAI 编辑",
  };
  return labels[provider] ?? provider;
}

export function toolRefineSpecLine(
  tool: StudioTool,
  resolution: string,
  count = 1,
): string {
  const countPart = tool.id === "variation" ? `${count} 张 · ` : "";
  if (tool.id === "expand") {
    return `真扩图 · ${resolution.toUpperCase()} · ${countPart}`;
  }
  return `${resolution.toUpperCase()} · ${countPart}`;
}

/** 工具确认卡片：下一步操作说明 */
export const TOOL_CONFIRM_STEPS: Record<string, string> = {
  cutout: "一键生成透明底 PNG，主体边缘自动优化",
  upscale: "在保持风格的前提下提升分辨率与细节",
  enhance: "轻量锐化与对比增强，适合预览稿变清晰",
  variation: "同构图微差：细节、光影会有可见变化",
  expand: "确认后在画布拖拽外框扩边，可选 1:1 / 4:3 / 16:9 / 9:16",
  erase: "确认后用画笔涂抹要消除的区域（可调粗细、撤销/重做/清空）",
  inpaint: "确认后先画笔圈选，再在工作台填写修改提示词",
  "focus-edit": "确认后在图上点击目标，再在工作台输入短 prompt",
  text: "选择字体与字号，填写要替换成的文字内容",
  blend: "确认后 @ 第二张图到工作台，补充融合要求后提交",
  "grid-split": "选择行列数，一键将宫格图切分为独立图片",
};

export const TOOL_PROMPT_PLACEHOLDERS: Record<string, string> = {
  expand: "例如：向下延伸背景，保留主体居中…",
  erase: "可选：说明要去除的对象，如「路人」「水印」",
  inpaint: "例如：改成红色丝绒材质、换成蓝天白云…",
  "focus-edit": "例如：改成「SALE」、换成金属质感…",
  text: "例如：SUMMER SALE · 限时五折",
  blend: "例如：把两张图的产品自然合成在同一场景…",
};

export function toolConfirmPrimaryLabel(toolId: string): string {
  switch (toolId) {
    case "variation":
      return "生成变体";
    case "cutout":
      return "开始抠图";
    case "upscale":
      return "开始放大";
    case "enhance":
      return "开始增强";
    case "expand":
      return "调整扩图范围";
    case "erase":
    case "inpaint":
      return "开始涂抹";
    case "focus-edit":
      return "开始点选";
    case "text":
      return "确认改字";
    case "blend":
      return "继续到工作台";
    case "grid-split":
      return "一键切分";
    default:
      return "确认执行";
  }
}
