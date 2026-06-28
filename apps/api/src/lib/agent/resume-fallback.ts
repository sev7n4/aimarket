import type { AgentSessionState, JobObservation } from "@aimarket/agent-core";
import { observeAgentStep } from "./observe-step.js";
import { executeAgentPlanStep } from "./execute-step.js";
import {
  parseAgentRunPlan,
  parseAgentRunStateJson,
  updateAgentRun,
  type AgentRunRow,
} from "./runs.js";

/** API 重启后 MemorySaver 丢失时，用 DB 行 + Job 结果续跑 Agent Run。 */
export async function resumeAgentRunFromDb(
  row: AgentRunRow,
  observation: JobObservation,
): Promise<AgentSessionState> {
  const plan = parseAgentRunPlan(row);
  if (!plan) {
    throw new Error("RUN_PLAN_MISSING");
  }

  const persisted = parseAgentRunStateJson(row);
  const stepRetries = { ...persisted.stepRetries };
  let observations = [...persisted.observations, observation];

  let state: AgentSessionState = {
    runId: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    prompt: row.prompt,
    mode: row.mode,
    confirmed: true,
    plan,
    currentStepIndex: row.current_step_index,
    pendingJobId: null,
    observations,
    status: "running",
    stepRetries,
    observeDecision: null,
  };

  const observeResult = await observeAgentStep(state, observation);
  if (observeResult.decision === "fail") {
    state = {
      ...state,
      status: "failed",
      error: observeResult.note ?? "质检未通过",
    };
    persist(state);
    return state;
  }

  if (observeResult.decision === "retry") {
    const used = stepRetries[state.currentStepIndex] ?? 0;
    const max = Number(process.env.AGENT_VLM_MAX_STEP_RETRIES ?? "1");
    if (used < max) {
      stepRetries[state.currentStepIndex] = used + 1;
      const { jobId } = await executeAgentPlanStep(state, plan, state.currentStepIndex);
      state = {
        ...state,
        stepRetries,
        pendingJobId: jobId,
        status: "waiting_job",
      };
      persist(state);
      return state;
    }
    state = {
      ...state,
      status: "failed",
      error: observeResult.note ?? "质检未通过（已达重试上限）",
    };
    persist(state);
    return state;
  }

  const nextIndex = state.currentStepIndex + 1;
  if (nextIndex >= plan.steps.length) {
    state = {
      ...state,
      currentStepIndex: nextIndex,
      status: "completed",
      pendingJobId: null,
    };
    persist(state);
    return state;
  }

  state = {
    ...state,
    currentStepIndex: nextIndex,
    status: "running",
  };

  const step = plan.steps[nextIndex];
  if (step?.type === "video") {
    state = {
      ...state,
      status: "failed",
      error: "视频步骤请使用 P2 Skill 套餐",
    };
    persist(state);
    return state;
  }

  try {
    const { jobId } = await executeAgentPlanStep(state, plan, nextIndex);
    state = {
      ...state,
      pendingJobId: jobId,
      status: "waiting_job",
    };
  } catch (err) {
    state = {
      ...state,
      status: "failed",
      error: err instanceof Error ? err.message : "执行步骤失败",
    };
  }

  persist(state);
  return state;

  function persist(s: AgentSessionState) {
    updateAgentRun(row.id, {
      status: s.status,
      plan: s.plan,
      currentStepIndex: s.currentStepIndex,
      pendingJobId: s.pendingJobId,
      planSource: s.plan?.planSource ?? null,
      skillId: s.plan?.skillId ?? null,
      error: s.error ?? null,
      stateJson: JSON.stringify({
        observations: s.observations,
        stepRetries: s.stepRetries ?? {},
      }),
    });
  }
}
