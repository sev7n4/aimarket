import { ECOMMERCE_SLIDES } from "./ecommerce.js";
import { estimatePoints, estimateToolPoints } from "./pricing.js";
import { suggestModel } from "./router.js";
import { listToolsPublic } from "./tools.js";

export type PlanStepType = "generate" | "tool" | "video";

export interface PlanStep {
  type: PlanStepType;
  toolId?: string;
  label: string;
  prompt?: string;
}

export interface AgentPlan {
  intent: string;
  modelId: string;
  mode: string;
  resolution: string;
  aspectRatio: string;
  count: number;
  steps: PlanStep[];
  estimatedPoints: number;
  requiresConfirm: boolean;
  reason: string;
}

const TOOL_KEYWORDS: Array<{ toolId: string; keywords: string[] }> = [
  { toolId: "cutout", keywords: ["抠图", "去背景", "透明底", "白底"] },
  { toolId: "expand", keywords: ["扩图", "扩展画面", "补全边缘"] },
  { toolId: "erase", keywords: ["消除", "去掉", "移除", "擦除"] },
  { toolId: "inpaint", keywords: ["局部", "改这里", "替换区域"] },
  { toolId: "text", keywords: ["改字", "换文字", "标题"] },
  { toolId: "upscale", keywords: ["超分", "放大", "高清"] },
  { toolId: "enhance", keywords: ["增强", "锐化", "细节"] },
  { toolId: "blend", keywords: ["融合", "合成", "混合"] },
];

const ECOMMERCE_KEYWORDS = ["电商", "主图", "详情", "套图", "上架", "淘宝", "京东"];
const CONFIRM_POINTS_THRESHOLD = 40;

function detectToolSteps(prompt: string): PlanStep[] {
  const steps: PlanStep[] = [];
  const toolNames = new Map(
    listToolsPublic().map((t) => [t.id, t.name] as const),
  );

  for (const { toolId, keywords } of TOOL_KEYWORDS) {
    if (keywords.some((k) => prompt.includes(k))) {
      steps.push({
        type: "tool",
        toolId,
        label: toolNames.get(toolId) ?? toolId,
      });
    }
  }
  return steps;
}

function isEcommerceIntent(mode: string, prompt: string): boolean {
  return mode === "ecommerce" || ECOMMERCE_KEYWORDS.some((k) => prompt.includes(k));
}

export function buildAgentPlan(input: {
  prompt: string;
  mode: string;
  modelId?: string;
  resolution?: string;
  aspectRatio?: string;
  count?: number;
}): AgentPlan {
  const prompt = input.prompt.trim();
  const mode = input.mode || "chat";
  const route = suggestModel(mode, prompt);
  const modelId = input.modelId ?? route.modelId;
  const resolution = input.resolution ?? (mode === "ecommerce" ? "2k" : "1k");
  const aspectRatio = input.aspectRatio ?? "1:1";

  const toolSteps = detectToolSteps(prompt);
  const ecommerce = isEcommerceIntent(mode, prompt);
  const count =
    input.count ?? (ecommerce ? ECOMMERCE_SLIDES.length : toolSteps.length ? 1 : 1);

  const steps: PlanStep[] = [];

  if (ecommerce) {
    for (const slide of ECOMMERCE_SLIDES) {
      steps.push({
        type: "generate",
        label: slide.label,
        prompt: `${prompt}\n【画面】${slide.label}`,
      });
    }
  } else if (toolSteps.length > 0) {
    steps.push(...toolSteps);
    if (!toolSteps.some((s) => s.toolId === "upscale") && prompt.includes("高清")) {
      steps.push({ type: "tool", toolId: "upscale", label: "超分" });
    }
  } else {
    steps.push({
      type: "generate",
      label: "生成图片",
      prompt,
    });
  }

  let estimatedPoints = 0;
  for (const step of steps) {
    if (step.type === "tool" && step.toolId) {
      estimatedPoints += estimateToolPoints(step.toolId, resolution, 1);
    } else {
      estimatedPoints += estimatePoints(modelId, 1, resolution);
    }
  }

  const requiresConfirm =
    estimatedPoints >= CONFIRM_POINTS_THRESHOLD ||
    steps.length > 1 ||
    count > 1;

  return {
    intent: prompt,
    modelId,
    mode: ecommerce ? "ecommerce" : mode,
    resolution,
    aspectRatio,
    count: ecommerce ? ECOMMERCE_SLIDES.length : count,
    steps,
    estimatedPoints,
    requiresConfirm,
    reason: route.reason,
  };
}
