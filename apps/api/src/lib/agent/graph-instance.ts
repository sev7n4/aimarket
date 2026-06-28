import { createSessionGraph } from "@aimarket/agent-core";
import { resolveAgentPlan } from "./resolve-plan.js";
import { executeAgentPlanStep } from "./execute-step.js";
import { observeAgentStep } from "./observe-step.js";
import { getAgentCheckpointer } from "./checkpointer.js";

let graph: ReturnType<typeof createSessionGraph> | null = null;

export function getAgentGraph(): ReturnType<typeof createSessionGraph> {
  if (!graph) {
    graph = createSessionGraph(
      {
        resolvePlan: resolveAgentPlan,
        executeStep: async (state, stepIndex) => {
          if (!state.plan) throw new Error("执行时缺少 plan");
          const { jobId } = await executeAgentPlanStep(state, state.plan, stepIndex);
          return { jobId };
        },
        observeStep: observeAgentStep,
        maxStepRetries: Number(process.env.AGENT_VLM_MAX_STEP_RETRIES ?? "1"),
      },
      getAgentCheckpointer(),
    );
  }
  return graph;
}
