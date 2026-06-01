import { Command } from "@langchain/langgraph";
import {
  createSessionGraph,
  type AgentSessionState,
  type JobObservation,
} from "@aimarket/agent-core";
import { resolveAgentPlan } from "./resolve-plan.js";
import { executeAgentPlanStep } from "./execute-step.js";
import { observeAgentStep } from "./observe-step.js";
import {
  getAgentRun,
  parseAgentRunPlan,
  serializeRunForApi,
  updateAgentRun,
  type AgentRunRow,
} from "./runs.js";

const graph = createSessionGraph({
  resolvePlan: resolveAgentPlan,
  executeStep: (state: AgentSessionState, stepIndex: number) => {
    if (!state.plan) throw new Error("执行时缺少 plan");
    const { jobId } = executeAgentPlanStep(state, state.plan, stepIndex);
    return Promise.resolve({ jobId });
  },
  observeStep: observeAgentStep,
  maxStepRetries: Number(process.env.AGENT_VLM_MAX_STEP_RETRIES ?? "1"),
});

function rowToInitialState(row: AgentRunRow, confirmed: boolean): AgentSessionState {
  return {
    runId: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    prompt: row.prompt,
    mode: row.mode,
    confirmed,
    plan: parseAgentRunPlan(row),
    currentStepIndex: row.current_step_index,
    pendingJobId: row.pending_job_id,
    observations: [],
    status: row.status as AgentSessionState["status"],
    error: row.error ?? undefined,
    stepRetries: {},
    observeDecision: null,
  };
}

function persistGraphState(runId: string, state: AgentSessionState) {
  updateAgentRun(runId, {
    status: state.status,
    plan: state.plan,
    currentStepIndex: state.currentStepIndex,
    pendingJobId: state.pendingJobId,
    planSource: state.plan?.planSource ?? null,
    skillId: state.plan?.skillId ?? null,
    error: state.error ?? null,
    stateJson: JSON.stringify({
      observations: state.observations,
      stepRetries: state.stepRetries ?? {},
    }),
  });
}

async function invokeGraph(
  runId: string,
  input: AgentSessionState | Command,
) {
  const config = { configurable: { thread_id: runId } };
  const result = await graph.invoke(input, config);
  persistGraphState(runId, result as AgentSessionState);
  return result as AgentSessionState;
}

export async function startAgentRun(userId: string, runId: string) {
  const row = getAgentRun(userId, runId);
  if (!row) throw new Error("RUN_NOT_FOUND");

  const initial = rowToInitialState(row, false);
  const result = await invokeGraph(runId, initial);
  return result;
}

export async function confirmAgentRun(userId: string, runId: string) {
  const row = getAgentRun(userId, runId);
  if (!row) throw new Error("RUN_NOT_FOUND");
  if (row.status !== "waiting_confirm") {
    throw new Error("RUN_NOT_WAITING_CONFIRM");
  }

  const plan = parseAgentRunPlan(row);
  const result = await graph.invoke(
    new Command({
      update: {
        confirmed: true,
        status: "running",
        plan,
      },
      goto: "execute_step" as const,
    }),
    { configurable: { thread_id: runId } },
  );
  persistGraphState(runId, result as AgentSessionState);
  return result as AgentSessionState;
}

export async function resumeAgentRunOnJobCompleted(
  jobId: string,
  observation: JobObservation,
) {
  const { findAgentRunByJobId } = await import("./runs.js");
  const linked = findAgentRunByJobId(jobId);
  if (!linked) return null;
  if (linked.run.status !== "waiting_job") return null;

  const config = { configurable: { thread_id: linked.run.id } };
  const result = await graph.invoke(
    new Command({ resume: observation }),
    config,
  );
  persistGraphState(linked.run.id, result as AgentSessionState);
  return result as AgentSessionState;
}

export function getAgentRunApiView(userId: string, runId: string) {
  const row = getAgentRun(userId, runId);
  if (!row) return null;
  let observations: JobObservation[] = [];
  if (row.state_json) {
    try {
      const parsed = JSON.parse(row.state_json) as {
        observations?: JobObservation[];
      };
      observations = parsed.observations ?? [];
    } catch {
      observations = [];
    }
  }
  return serializeRunForApi(row, observations);
}
