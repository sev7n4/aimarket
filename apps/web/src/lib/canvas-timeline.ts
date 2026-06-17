import type {
  AgentPlan,
  AgentRun,
  AgentRunStatus,
  DramaRun,
  SkillRun,
  SkillRunStatus,
} from "@/lib/types";
import type { DramaPlanStreamEvent } from "@/lib/drama-plan-stream";
import { DRAMA_PLAN_AGENT_META } from "@/components/drama-plan-timeline";

export interface OrchestrationStepView {
  label: string;
  type: string;
  done: boolean;
  current: boolean;
  summary?: string;
}

export interface OrchestrationTimelineEvent {
  id: string;
  runType: "agent" | "skill" | "drama_plan" | "drama_run";
  title: string;
  status: AgentRunStatus | SkillRunStatus | "preview" | "planning" | "failed";
  prompt: string;
  steps: OrchestrationStepView[];
  estimatedPoints?: number;
  planReason?: string | null;
  error?: string | null;
  showConfirm: boolean;
  /** 执行中可取消（非待确认态） */
  showCancelActive: boolean;
  planLoading?: boolean;
  updatedAt: string;
  /** 短剧多 Agent 规划 SSE 事件 */
  dramaPlanEvents?: DramaPlanStreamEvent[];
  dramaPlanCurrentAgent?: string | null;
}

export interface OrchestrationTimelineActions {
  onConfirm?: () => void;
  onCancel?: () => void;
  onRerunFromAgent?: (agent: string) => void;
  confirmBusy?: boolean;
  readOnly?: boolean;
}

const AGENT_TERMINAL = new Set<AgentRunStatus>([
  "completed",
  "failed",
  "cancelled",
]);
const SKILL_TERMINAL = new Set<SkillRunStatus>([
  "completed",
  "failed",
  "cancelled",
]);

function isActiveOrchestration(
  status: AgentRunStatus | SkillRunStatus,
): boolean {
  return (
    !AGENT_TERMINAL.has(status as AgentRunStatus) &&
    !SKILL_TERMINAL.has(status as SkillRunStatus) &&
    status !== "waiting_confirm"
  );
}

function agentStepsFromPlan(
  plan: AgentPlan,
  run: AgentRun | null,
): OrchestrationStepView[] {
  const currentIdx = run?.currentStepIndex ?? 0;
  const active =
    run &&
    (run.status === "running" || run.status === "waiting_job");
  return plan.steps.map((step, i) => ({
    label: step.label,
    type: step.type,
    done: Boolean(run && i < currentIdx),
    current: Boolean(active && i === currentIdx),
  }));
}

export function buildOrchestrationTimelineEvent(input: {
  agentRun: AgentRun | null;
  skillRun: SkillRun | null;
  agentPreviewPlan: AgentPlan | null;
  agentPreviewLoading?: boolean;
  prompt: string;
}): OrchestrationTimelineEvent | null {
  const { agentRun, skillRun, agentPreviewPlan, agentPreviewLoading, prompt } =
    input;
  const trimmed = prompt.trim();

  if (skillRun) {
    return {
      id: `skill-${skillRun.id}`,
      runType: "skill",
      title: `套餐 · ${skillRun.skillName}`,
      status: skillRun.status,
      prompt: skillRun.prompt || trimmed,
      steps: skillRun.steps.map((s) => ({
        label: s.label,
        type: s.type,
        done: s.done,
        current: s.current,
      })),
      estimatedPoints: skillRun.estimatedPoints,
      error: skillRun.error,
      showConfirm: skillRun.status === "waiting_confirm",
      showCancelActive: isActiveOrchestration(skillRun.status),
      updatedAt: skillRun.updatedAt,
    };
  }

  if (agentRun) {
    const plan = agentRun.plan;
    if (!plan?.steps.length) return null;
    return {
      id: `agent-${agentRun.id}`,
      runType: "agent",
      title: "Agent 执行",
      status: agentRun.status,
      prompt: agentRun.prompt || trimmed,
      steps: agentStepsFromPlan(plan, agentRun),
      estimatedPoints: plan.estimatedPoints,
      error: agentRun.error,
      showConfirm: agentRun.status === "waiting_confirm",
      showCancelActive: isActiveOrchestration(agentRun.status),
      updatedAt: agentRun.updatedAt,
    };
  }

  if (agentPreviewLoading && trimmed) {
    return {
      id: "agent-preview-loading",
      runType: "agent",
      title: "Agent 执行计划",
      status: "preview",
      prompt: trimmed,
      steps: [],
      planLoading: true,
      showConfirm: false,
      showCancelActive: false,
      updatedAt: new Date().toISOString(),
    };
  }

  if (agentPreviewPlan?.steps.length && trimmed) {
    return {
      id: "agent-preview",
      runType: "agent",
      title: "Agent 执行计划",
      status: "preview",
      prompt: trimmed,
      steps: agentStepsFromPlan(agentPreviewPlan, null),
      estimatedPoints: agentPreviewPlan.estimatedPoints,
      planReason: agentPreviewPlan.reason ?? null,
      error: null,
      showConfirm: agentPreviewPlan.requiresConfirm,
      showCancelActive: false,
      updatedAt: new Date().toISOString(),
    };
  }

  return null;
}

export function buildDramaPlanTimelineEvent(input: {
  planRunId: string;
  status: "planning" | "completed" | "failed";
  prompt: string;
  currentAgent?: string | null;
  events: DramaPlanStreamEvent[];
  error?: string | null;
}): OrchestrationTimelineEvent | null {
  if (
    input.status !== "planning" &&
    input.status !== "failed" &&
    input.status !== "completed"
  ) {
    return null;
  }
  const doneAgents = new Set(
    input.events
      .filter((e) => e.type === "agent_done")
      .map((e) => (e.type === "agent_done" ? e.agent : "")),
  );
  const steps: OrchestrationStepView[] = DRAMA_PLAN_AGENT_META.map((meta) => {
    const done = doneAgents.has(meta.id);
    const current = input.currentAgent === meta.id && !done;
    const summaryEv = [...input.events]
      .reverse()
      .find((e) => e.type === "agent_done" && e.agent === meta.id);
    return {
      label: meta.label,
      type: meta.id,
      done,
      current,
      summary:
        summaryEv?.type === "agent_done" ? summaryEv.summary : undefined,
    };
  });

  return {
    id: `drama-plan-${input.planRunId}`,
    runType: "drama_plan",
    title: "AI 短剧 · 多 Agent 规划",
    status:
      input.status === "failed"
        ? "failed"
        : input.status === "completed"
          ? "completed"
          : "planning",
    prompt: input.prompt,
    steps,
    error: input.error,
    showConfirm: false,
    showCancelActive: false,
    updatedAt: new Date().toISOString(),
    dramaPlanEvents: input.events,
    dramaPlanCurrentAgent: input.currentAgent,
  };
}

const DRAMA_RUN_TERMINAL = new Set(["completed", "failed", "cancelled"]);

export function buildDramaRunTimelineEvent(input: {
  run: DramaRun;
  prompt: string;
}): OrchestrationTimelineEvent | null {
  const { run, prompt } = input;
  if (run.status === "waiting_confirm") return null;

  const active = !DRAMA_RUN_TERMINAL.has(run.status);
  const steps: OrchestrationStepView[] = run.pipelineSteps.map((step) => ({
    label: step.label,
    type: step.id,
    done: step.done,
    current: step.current || (run.status === "failed" && step.index === run.currentStepIndex),
  }));

  return {
    id: `drama-run-${run.id}`,
    runType: "drama_run",
    title: "AI 短剧 · 制作",
    status:
      run.status === "failed"
        ? "failed"
        : run.status === "completed"
          ? "completed"
          : run.status === "waiting_job"
            ? "waiting_job"
            : "running",
    prompt: prompt.trim() || run.project.script.logline || run.project.script.title,
    steps,
    estimatedPoints: run.estimatedPoints,
    error: run.error,
    showConfirm: false,
    showCancelActive: active,
    updatedAt: run.updatedAt,
  };
}
