import { getModel } from "./models.js";
import { getTool } from "./tools.js";

const RESOLUTION_FACTOR: Record<string, number> = {
  "1k": 1,
  "2k": 1.5,
  "4k": 2,
};

const BASE_POINTS = 10;

export function estimatePoints(
  modelId: string,
  count: number,
  resolution = "1k",
): number {
  const model = getModel(modelId);
  const factor = model?.pointsFactor ?? 1;
  const resFactor = RESOLUTION_FACTOR[resolution.toLowerCase()] ?? 1;
  return Math.ceil(BASE_POINTS * factor * resFactor * count);
}

/** 工具链积分：按 toolId × 分辨率 × 张数，不绑定 CreationPanel 模型 */
export function estimateToolPoints(
  toolId: string,
  resolution = "1k",
  count = 1,
): number {
  const tool = getTool(toolId);
  const resFactor = RESOLUTION_FACTOR[resolution.toLowerCase()] ?? 1;
  const toolFactor = tool?.pricingFactor ?? 1;
  const safeCount = Math.max(1, Math.min(4, count));
  return Math.max(1, Math.ceil(BASE_POINTS * resFactor * toolFactor * safeCount));
}
