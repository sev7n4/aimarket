import type {
  AgentPlan,
  AgentRun,
  AgentRunStatus,
  SkillRun,
  SkillRunStatus,
} from "@/lib/types";

export interface OrchestrationStepView {
  label: string;
  type: string;
  done: boolean;
  current: boolean;
  summary?: string;
}

export interface OrchestrationTimelineEvent {
  id: string;
  runType: "agent" | "skill";
  title: string;
  status: AgentRunStatus | SkillRunStatus | "preview";
  prompt: string;
  steps: OrchestrationStepView[];
  estimatedPoints?: number;
  planReason?: string | null;
  error?: string | null;
  showConfirm: boolean;
  showCancelActive: boolean;
  planLoading?: boolean;
  updatedAt: string;
}

export interface OrchestrationTimelineActions {
  onConfirm?: () => void;
  onCancel?: () => void;
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
