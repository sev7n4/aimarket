import { Command } from "@langchain/langgraph";
import type { AgentSessionState, JobObservation } from "@aimarket/agent-core";
import { getAgentGraph } from "./graph-instance.js";
import {
  getAgentRun,
  parseAgentRunPlan,
  parseAgentRunStateJson,
  serializeRunForApi,
  updateAgentRun,
  type AgentRunRow,
} from "./runs.js";
import { resumeAgentRunFromDb } from "./resume-fallback.js";
import {
  AGENT_CANVAS_TOOLS,
  executeCanvasToolCall,
} from "./canvas-tools.js";

// ─── Agent 工具注册 ──────────────────────────────────────────

/** 返回 Agent 可调用的所有画布操作工具定义 */
export function getAgentCanvasToolDefinitions() {
  return AGENT_CANVAS_TOOLS;
}

/** 判断工具名是否为画布操作 */
export function isCanvasTool(toolName: string): boolean {
  return toolName.startsWith("canvas_");
}

/** 分发画布工具调用，检测 canvas_ 前缀时委托给 executeCanvasToolCall */
export async function dispatchCanvasTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!isCanvasTool(toolName)) {
    throw new Error(`非画布工具: ${toolName}`);
  }
  return executeCanvasToolCall(toolName, args);
}

function rowToInitialState(row: AgentRunRow, confirmed: boolean): AgentSessionState {
  const persisted = parseAgentRunStateJson(row);
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
    observations: persisted.observations,
    status: row.status as AgentSessionState["status"],
    error: row.error ?? undefined,
    stepRetries: persisted.stepRetries,
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
  const graph = getAgentGraph();
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
  const graph = getAgentGraph();
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

  const runId = linked.run.id;
  const graph = getAgentGraph();
  const config = { configurable: { thread_id: runId } };

  try {
    const snapshot = await graph.getState(config);
    if (snapshot.next?.length) {
      const result = await graph.invoke(
        new Command({ resume: observation }),
        config,
      );
      persistGraphState(runId, result as AgentSessionState);
      return result as AgentSessionState;
    }
  } catch (err) {
    console.warn("[agent] graph resume failed, trying DB fallback:", err);
  }

  const state = await resumeAgentRunFromDb(linked.run, observation);
  return state;
}

export function getAgentRunApiView(userId: string, runId: string) {
  const row = getAgentRun(userId, runId);
  if (!row) return null;
  const { observations } = parseAgentRunStateJson(row);
  return serializeRunForApi(row, observations);
}
