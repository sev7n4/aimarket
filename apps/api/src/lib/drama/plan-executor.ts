import { buildRuleBasedProject } from "./planner.js";
import { estimateDramaPoints } from "./estimate.js";
import { publishPlanEvent } from "./plan-events.js";
import {
  defaultAgentsJson,
  getDramaPlanRun,
  parseAgentsJson,
  parseReasoningJson,
  updateDramaPlanRun,
} from "./plan-runs.js";
import { createDramaProject } from "./projects.js";
import { planDramaProjectMultiAgentWithEvents } from "./planner/index.js";
import { isDramaMultiAgentPlanEnabled } from "./planner/reasoning.js";
import {
  DRAMA_PLAN_AGENT_LABELS,
  DRAMA_PLAN_AGENT_ORDER,
  type DramaPlanAgentId,
  type DramaPlanAgentsJson,
  type DramaPlanEmit,
  type DramaPlanEvent,
} from "./planner/types.js";
import { isAgentLlmEnabled } from "@aimarket/agent-core";

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

export function dispatchDramaPlanRun(runId: string, userId: string) {
  void executeDramaPlanRun(runId, userId).catch((err) => {
    console.error("[drama-plan] execute failed:", err);
  });
}

async function executeDramaPlanRun(runId: string, userId: string) {
  const row = getDramaPlanRun(userId, runId);
  if (!row || row.status !== "planning") return;

  const input = {
    userIdea: row.user_idea,
    targetDurationSec: row.target_duration_sec ?? undefined,
    aspectRatio: (row.aspect_ratio as "9:16" | "16:9" | undefined) ?? undefined,
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
    const projectData =
      isAgentLlmEnabled() && isDramaMultiAgentPlanEnabled()
        ? await planDramaProjectMultiAgentWithEvents(input, emit)
        : await runRuleBasedWithEvents(input, emit);

    const projectRow = createDramaProject({
      sessionId: row.session_id,
      userId: row.user_id,
      project: projectData,
    });
    const estimatedPoints = estimateDramaPoints(projectData);

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
      });
    } catch (fallbackErr) {
      const fallbackMessage =
        fallbackErr instanceof Error
          ? fallbackErr.message
          : "短剧规划回退失败";
      updateDramaPlanRun(runId, {
        status: "failed",
        currentAgent: null,
        error: fallbackMessage,
        agents,
        reasoning,
      });
      publishPlanEvent(runId, {
        type: "plan_failed",
        error: fallbackMessage,
      });
    }
  }
}
