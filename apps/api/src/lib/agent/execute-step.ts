import type { AgentPlan, AgentSessionState } from "@aimarket/agent-core";
import { ECOMMERCE_SLIDES } from "../ecommerce.js";
import { createGenerationJob } from "../jobs.js";
import { getTool } from "../tools.js";
import { linkAgentRunJob } from "./runs.js";

export function executeAgentPlanStep(
  state: AgentSessionState,
  plan: AgentPlan,
  stepIndex: number,
): { jobId: string; pointsCost: number } {
  const step = plan.steps[stepIndex];
  if (!step) {
    throw new Error(`无效步骤索引: ${stepIndex}`);
  }

  if (step.type === "tool") {
    if (!step.toolId) throw new Error("工具步骤缺少 toolId");
    getTool(step.toolId);
    const prompt = step.prompt?.trim() || plan.intent;
    const { jobId, pointsCost } = createGenerationJob({
      sessionId: state.sessionId,
      userId: state.userId,
      prompt,
      modelId: plan.modelId,
      mode: state.mode,
      count: 1,
      resolution: plan.resolution,
      aspectRatio: plan.aspectRatio,
      toolType: step.toolId,
      sourceLane: "agent",
    });
    linkAgentRunJob(state.runId, jobId, stepIndex);
    return { jobId, pointsCost };
  }

  const prompt = step.prompt?.trim() || plan.intent;
  const slideLabels =
    plan.mode === "ecommerce" && stepIndex === 0
      ? ECOMMERCE_SLIDES.map((s) => s.label)
      : undefined;
  const count =
    slideLabels ? ECOMMERCE_SLIDES.length : 1;

  const { jobId, pointsCost } = createGenerationJob({
    sessionId: state.sessionId,
    userId: state.userId,
    prompt,
    modelId: plan.modelId,
    mode: plan.mode,
    count,
    resolution: plan.resolution,
    aspectRatio: plan.aspectRatio,
    toolType:
      plan.mode === "ecommerce" && slideLabels ? "ecommerce-set" : undefined,
    slideLabels,
    sourceLane: "agent",
  });
  linkAgentRunJob(state.runId, jobId, stepIndex);
  return { jobId, pointsCost };
}
