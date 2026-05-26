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

export function estimateToolPoints(
  modelId: string,
  toolId: string,
  resolution = "1k",
): number {
  const tool = getTool(toolId);
  const base = estimatePoints(modelId, 1, resolution);
  const toolFactor = tool?.pricingFactor ?? 1;
  return Math.max(1, Math.ceil(base * toolFactor));
}
