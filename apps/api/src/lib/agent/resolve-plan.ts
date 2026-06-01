import {
  buildLlmPlanDraft,
  isAgentLlmEnabled,
  mergeLlmDraftIntoPlan,
  type AgentPlan,
  type PublicToolMeta,
} from "@aimarket/agent-core";
import { ECOMMERCE_SLIDES } from "../ecommerce.js";
import { buildAgentPlan } from "../planner.js";
import { estimatePoints, estimateToolPoints } from "../pricing.js";
import { suggestModel } from "../router.js";
import { listToolsPublic } from "../tools.js";

const CONFIRM_POINTS_THRESHOLD = 40;

export interface ResolvePlanInput {
  prompt: string;
  mode: string;
  modelId?: string;
  resolution?: string;
  aspectRatio?: string;
  count?: number;
}

function enrichPlan(
  base: ReturnType<typeof buildAgentPlan>,
  planSource: "llm" | "rule",
  draftSteps?: AgentPlan["steps"],
): AgentPlan {
  const steps = draftSteps ?? base.steps;
  const route = suggestModel(base.mode, base.intent);
  let estimatedPoints = 0;
  for (const step of steps) {
    if (step.type === "tool" && step.toolId) {
      estimatedPoints += estimateToolPoints(step.toolId, base.resolution, 1);
    } else if (step.type === "generate") {
      estimatedPoints += estimatePoints(base.modelId, 1, base.resolution);
    }
  }

  const requiresConfirm =
    estimatedPoints >= CONFIRM_POINTS_THRESHOLD ||
    steps.length > 1 ||
    base.count > 1;

  return {
    ...base,
    steps,
    estimatedPoints,
    requiresConfirm,
    reason: base.reason || route.reason,
    planSource,
  };
}

export async function resolveAgentPlan(
  input: ResolvePlanInput,
): Promise<AgentPlan> {
  const rulePlan = buildAgentPlan(input);

  if (!isAgentLlmEnabled()) {
    return enrichPlan(rulePlan, "rule");
  }

  const tools: PublicToolMeta[] = listToolsPublic().map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
  }));

  try {
    const draft = await buildLlmPlanDraft({
      prompt: input.prompt,
      mode: input.mode,
      tools,
    });

    const ecommerce =
      input.mode === "ecommerce" ||
      draft.steps.every((s) => s.type === "generate");
    const count =
      input.count ??
      (ecommerce ? ECOMMERCE_SLIDES.length : draft.steps.length || 1);

    const merged = mergeLlmDraftIntoPlan(draft, {
      intent: draft.intent || input.prompt.trim(),
      modelId: input.modelId ?? rulePlan.modelId,
      mode: rulePlan.mode,
      resolution: input.resolution ?? rulePlan.resolution,
      aspectRatio: input.aspectRatio ?? rulePlan.aspectRatio,
      count,
      steps: draft.steps,
      estimatedPoints: rulePlan.estimatedPoints,
      requiresConfirm: rulePlan.requiresConfirm,
      reason: draft.reason ?? rulePlan.reason,
      skillId: draft.skillId,
    });

    return enrichPlan(
      { ...rulePlan, ...merged, steps: merged.steps },
      "llm",
      merged.steps,
    );
  } catch (err) {
    console.warn("[agent] LLM plan failed, using rule planner:", err);
    return enrichPlan(rulePlan, "rule");
  }
}
