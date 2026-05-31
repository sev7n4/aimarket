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
};

/** 工具网格副文案：是否需要 prompt、张数、推荐路径等 */
export const TOOL_GRID_HINTS: Record<string, string> = {
  variation: "选图 · 1–4 张 · 同构图微差",
  expand: "选图 + prompt · 推荐工具链",
  cutout: "选图 · 一键 · 推荐工具链",
  inpaint: "圈选 + prompt",
  "focus-edit": "点选 + prompt",
  erase: "圈选区域",
  upscale: "选图 · 2x/4x",
  enhance: "选图 · 一键",
  blend: "多图融合",
  text: "选图改字",
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
  const points = estimateToolPointsClient(tool, resolution, count);
  const countPart = tool.id === "variation" ? `${count} 张 · ` : "";
  return `${resolution.toUpperCase()} · ${countPart}约 ${points} 积分`;
}
