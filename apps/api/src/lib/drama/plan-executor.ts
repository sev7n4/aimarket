import { buildRuleBasedProject, planDramaProject } from "./planner.js";
import { estimateDramaPoints } from "./estimate.js";
import { clearPlanEvents, publishPlanEvent } from "./plan-events.js";
import {
  defaultAgentsJson,
  getDramaPlanRun,
  parseAgentsJson,
  parseReasoningJson,
  resetPlanRunForRerun,
  updateDramaPlanRun,
} from "./plan-runs.js";
import {
  createDramaProject,
  getDramaProject,
  parseProjectJson,
  updateDramaProject,
} from "./projects.js";
import {
  planDramaProjectFromAgentWithEvents,
  planDramaProjectMultiAgentWithEvents,
} from "./planner/index.js";
import { mergePlanningContext } from "./planner/merge.js";
import { projectToPlanningContext } from "./planner/project-to-context.js";
import { isDramaMultiAgentPlanEnabled } from "./planner/reasoning.js";
import {
  DRAMA_PLAN_AGENT_LABELS,
  DRAMA_PLAN_AGENT_ORDER,
  type DramaPlanAgentId,
  type DramaPlanAgentsJson,
  type DramaPlanEmit,
  type DramaPlanEvent,
} from "./planner/types.js";
import { dramaProjectSchema, type DramaProjectData } from "./schema.js";
import {
  dramaCreditsAffordability,
  formatDramaInsufficientCreditsMessage,
} from "./credits-gate.js";
import { createDramaRun } from "./runs.js";
import { dispatchDramaRun } from "./executor.js";
import { mergeDramaProjectPatch } from "./merge-patch.js";
import { isAgentLlmEnabled } from "@aimarket/agent-core";
import { formatDramaPlanError } from "./plan-errors.js";
import type { DramaProjectType } from "./schema.js";

function syncAgentsFromEvent(
  agents: DramaPlanAgentsJson,
  reasoning: Partial<Record<DramaPlanAgentId, string>>,
  event: DramaPlanEvent,
): void {
  if (event.type === "agent_start") {
    agents[event.agent] = { status: "running" };
  } else if (event.type === "agent_reasoning") {
    reasoning[event.agent] = event.chunk;
    agents[event.agent] = {
      ...agents[event.agent],
      status: "running",
      reasoning: event.chunk,
    };
  } else if (event.type === "agent_done") {
    agents[event.agent] = {
      status: "done",
      summary: event.summary,
      reasoning: reasoning[event.agent],
      completedAt: new Date().toISOString(),
    };
  }
}

async function runRuleBasedWithEvents(
  input: Parameters<typeof buildRuleBasedProject>[0],
  emit: DramaPlanEmit,
): Promise<ReturnType<typeof buildRuleBasedProject>> {
  for (const agent of DRAMA_PLAN_AGENT_ORDER) {
    emit({ type: "agent_start", agent });
    emit({
      type: "agent_done",
      agent,
      summary: `${DRAMA_PLAN_AGENT_LABELS[agent]}完成（规则引擎）`,
    });
  }
  return buildRuleBasedProject(input);
}

function maybeAutoProduce(
  row: NonNullable<ReturnType<typeof getDramaPlanRun>>,
  projectId: string,
  estimatedPoints: number,
): { dramaRunId?: string; produceSkippedReason?: string } {
  if (!row.auto_produce) return {};

  const { ok, balance } = dramaCreditsAffordability(
    row.user_id,
    estimatedPoints,
  );
  if (!ok) {
    return {
      produceSkippedReason: formatDramaInsufficientCreditsMessage(
        estimatedPoints,
        balance,
      ),
    };
  }

  const run = createDramaRun({
    sessionId: row.session_id,
    userId: row.user_id,
    projectId,
    confirmed: true,
  });
  if (run.status !== "waiting_confirm") {
    dispatchDramaRun(run.id, row.user_id);
  }
  return { dramaRunId: run.id };
}

function safeMaybeAutoProduce(
  row: NonNullable<ReturnType<typeof getDramaPlanRun>>,
  projectId: string,
  estimatedPoints: number,
): { dramaRunId?: string; produceSkippedReason?: string } {
  try {
    return maybeAutoProduce(row, projectId, estimatedPoints);
  } catch (err) {
    const message = err instanceof Error ? err.message : "自动制作失败";
    console.warn("[drama-plan] autoProduce failed:", message);
    return { produceSkippedReason: formatDramaPlanError(message) };
  }
}

async function planProjectWithEvents(
  input: Parameters<typeof buildRuleBasedProject>[0],
  emit: DramaPlanEmit,
): Promise<DramaProjectData> {
  if (!isAgentLlmEnabled()) {
    return runRuleBasedWithEvents(input, emit);
  }
  if (isDramaMultiAgentPlanEnabled()) {
    try {
      return await planDramaProjectMultiAgentWithEvents(input, emit);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[drama-plan] multi_agent SSE failed, fallback:", message);
    }
  }
  const projectData = await planDramaProject(input, { planMode: "single" });
  for (const agent of DRAMA_PLAN_AGENT_ORDER) {
    emit({ type: "agent_start", agent });
    emit({
      type: "agent_done",
      agent,
      summary: `${DRAMA_PLAN_AGENT_LABELS[agent]}完成（规则引擎）`,
    });
  }
  return projectData;
}

export function dispatchDramaPlanRun(runId: string, userId: string) {
  void executeDramaPlanRun(runId, userId).catch((err) => {
    console.error("[drama-plan] execute failed:", err);
  });
}

export function prepareDramaPlanRerun(
  runId: string,
  userId: string,
  fromAgent: DramaPlanAgentId,
  projectPatch?: Record<string, unknown>,
): boolean {
  const row = getDramaPlanRun(userId, runId);
  if (!row?.project_id) return false;
  if (row.status === "planning") return false;

  const projectRow = getDramaProject(userId, row.project_id);
  if (!projectRow) return false;

  if (projectPatch) {
    const current = parseProjectJson(projectRow);
    const merged = mergeDramaProjectPatch(current, projectPatch);
    const validated = dramaProjectSchema.parse(merged);
    updateDramaProject(projectRow.id, { project: validated });
  }

  clearPlanEvents(runId);
  const agents = parseAgentsJson(row);
  resetPlanRunForRerun(runId, fromAgent, agents);
  return true;
}

export function dispatchDramaPlanRerun(
  runId: string,
  userId: string,
  fromAgent: DramaPlanAgentId,
) {
  void executeDramaPlanRerun(runId, userId, fromAgent).catch((err) => {
    console.error("[drama-plan] rerun failed:", err);
  });
}

async function executeDramaPlanRun(runId: string, userId: string) {
  const row = getDramaPlanRun(userId, runId);
  if (!row || row.status !== "planning") return;

  const input = {
    userIdea: row.user_idea,
    targetDurationSec: row.target_duration_sec ?? undefined,
    aspectRatio: (row.aspect_ratio as "9:16" | "16:9" | undefined) ?? undefined,
    projectType: (row.project_type as DramaProjectType) ?? "short_drama",
  };

  let agents = parseAgentsJson(row);
  let reasoning = parseReasoningJson(row);

  const emit: DramaPlanEmit = (event) => {
    publishPlanEvent(runId, event);
    syncAgentsFromEvent(agents, reasoning, event);
    if (event.type === "agent_start") {
      updateDramaPlanRun(runId, {
        currentAgent: event.agent,
        agents,
        reasoning,
      });
    } else if (
      event.type === "agent_reasoning" ||
      event.type === "agent_done"
    ) {
      updateDramaPlanRun(runId, { agents, reasoning });
    }
  };

  try {
    const projectData = await planProjectWithEvents(input, emit);

    const projectRow = createDramaProject({
      sessionId: row.session_id,
      userId: row.user_id,
      project: projectData,
    });
    const estimatedPoints = estimateDramaPoints(projectData);
    const autoProduce = safeMaybeAutoProduce(row, projectRow.id, estimatedPoints);

    updateDramaPlanRun(runId, {
      status: "completed",
      currentAgent: null,
      projectId: projectRow.id,
      agents,
      reasoning,
    });

    const completeEvent: DramaPlanEvent = {
      type: "plan_complete",
      projectId: projectRow.id,
      estimatedPoints,
      ...(autoProduce.dramaRunId ? { dramaRunId: autoProduce.dramaRunId } : {}),
      ...(autoProduce.produceSkippedReason
        ? { produceSkippedReason: autoProduce.produceSkippedReason }
        : {}),
    };
    publishPlanEvent(runId, completeEvent);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "短剧规划失败";
    console.warn("[drama-plan] failed, fallback rule-based:", message);

    try {
      agents = defaultAgentsJson();
      reasoning = {};
      const projectData = await runRuleBasedWithEvents(input, emit);
      const projectRow = createDramaProject({
        sessionId: row.session_id,
        userId: row.user_id,
        project: projectData,
      });
      const estimatedPoints = estimateDramaPoints(projectData);
      const autoProduce = safeMaybeAutoProduce(row, projectRow.id, estimatedPoints);
      updateDramaPlanRun(runId, {
        status: "completed",
        currentAgent: null,
        projectId: projectRow.id,
        agents,
        reasoning,
      });
      publishPlanEvent(runId, {
        type: "plan_complete",
        projectId: projectRow.id,
        estimatedPoints,
        ...(autoProduce.dramaRunId ? { dramaRunId: autoProduce.dramaRunId } : {}),
        ...(autoProduce.produceSkippedReason
          ? { produceSkippedReason: autoProduce.produceSkippedReason }
          : {}),
      });
    } catch (fallbackErr) {
      const fallbackMessage =
        fallbackErr instanceof Error
          ? fallbackErr.message
          : "短剧规划回退失败";
      const userError = formatDramaPlanError(fallbackMessage);
      updateDramaPlanRun(runId, {
        status: "failed",
        currentAgent: null,
        error: userError,
        agents,
        reasoning,
      });
      publishPlanEvent(runId, {
        type: "plan_failed",
        error: userError,
      });
    }
  }
}

async function executeDramaPlanRerun(
  runId: string,
  userId: string,
  fromAgent: DramaPlanAgentId,
) {
  const row = getDramaPlanRun(userId, runId);
  if (!row?.project_id || row.status !== "planning") return;

  const projectRow = getDramaProject(userId, row.project_id);
  if (!projectRow) return;

  let agents = parseAgentsJson(row);
  let reasoning = parseReasoningJson(row);

  const freshProjectRow = getDramaProject(userId, row.project_id)!;
  const ctx = projectToPlanningContext(parseProjectJson(freshProjectRow));

  const emit: DramaPlanEmit = (event) => {
    publishPlanEvent(runId, event);
    syncAgentsFromEvent(agents, reasoning, event);
    if (event.type === "agent_start") {
      updateDramaPlanRun(runId, {
        currentAgent: event.agent,
        agents,
        reasoning,
      });
    } else if (
      event.type === "agent_reasoning" ||
      event.type === "agent_done"
    ) {
      updateDramaPlanRun(runId, { agents, reasoning });
    }
  };

  try {
    const projectData =
      isAgentLlmEnabled() && isDramaMultiAgentPlanEnabled()
        ? await planDramaProjectFromAgentWithEvents(ctx, fromAgent, emit)
        : await runRuleBasedFromAgent(ctx, fromAgent, emit);

    updateDramaProject(row.project_id, { project: projectData });
    const estimatedPoints = estimateDramaPoints(projectData);
    const autoProduce = safeMaybeAutoProduce(row, row.project_id, estimatedPoints);

    updateDramaPlanRun(runId, {
      status: "completed",
      currentAgent: null,
      agents,
      reasoning,
    });

    publishPlanEvent(runId, {
      type: "plan_complete",
      projectId: row.project_id,
      estimatedPoints,
      ...(autoProduce.dramaRunId ? { dramaRunId: autoProduce.dramaRunId } : {}),
      ...(autoProduce.produceSkippedReason
        ? { produceSkippedReason: autoProduce.produceSkippedReason }
        : {}),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "短剧重跑失败";
    console.warn("[drama-plan] rerun LLM failed, fallback rule-based:", message);

    try {
      resetPlanRunForRerun(runId, fromAgent, agents);
      agents = parseAgentsJson(getDramaPlanRun(userId, runId)!);
      const projectData = await runRuleBasedFromAgent(ctx, fromAgent, emit);

      updateDramaProject(row.project_id, { project: projectData });
      const estimatedPoints = estimateDramaPoints(projectData);
      const autoProduce = safeMaybeAutoProduce(row, row.project_id, estimatedPoints);

      updateDramaPlanRun(runId, {
        status: "completed",
        currentAgent: null,
        agents,
        reasoning,
      });

      publishPlanEvent(runId, {
        type: "plan_complete",
        projectId: row.project_id,
        estimatedPoints,
        ...(autoProduce.dramaRunId ? { dramaRunId: autoProduce.dramaRunId } : {}),
        ...(autoProduce.produceSkippedReason
          ? { produceSkippedReason: autoProduce.produceSkippedReason }
          : {}),
      });
    } catch (fallbackErr) {
      const fallbackMessage =
        fallbackErr instanceof Error ? fallbackErr.message : "短剧重跑回退失败";
      const userError = formatDramaPlanError(fallbackMessage);
      updateDramaPlanRun(runId, {
        status: "failed",
        currentAgent: null,
        error: userError,
        agents,
        reasoning,
      });
      publishPlanEvent(runId, { type: "plan_failed", error: userError });
    }
  }
}

async function runRuleBasedFromAgent(
  ctx: ReturnType<typeof projectToPlanningContext>,
  fromAgent: DramaPlanAgentId,
  emit: DramaPlanEmit,
) {
  const startIdx = DRAMA_PLAN_AGENT_ORDER.indexOf(fromAgent);
  for (const agent of DRAMA_PLAN_AGENT_ORDER.slice(startIdx)) {
    emit({ type: "agent_start", agent });
    emit({
      type: "agent_done",
      agent,
      summary: `${DRAMA_PLAN_AGENT_LABELS[agent]}完成（规则引擎）`,
    });
  }
  if (fromAgent === "writer") {
    return buildRuleBasedProject(ctx.input);
  }
  return mergePlanningContext(ctx);
}
