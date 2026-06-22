import type { AgentRun, AgentRunStatus, SkillRun, SkillRunStatus } from "@/lib/types";

const SKILL_IN_FLIGHT_STATUSES: SkillRunStatus[] = [
  "queued",
  "running",
  "waiting_job",
];
const AGENT_IN_FLIGHT_STATUSES: AgentRunStatus[] = [
  "planning",
  "running",
  "waiting_job",
];

export function isSkillAwaitingConfirm(run: SkillRun | null | undefined): boolean {
  return run?.status === "waiting_confirm";
}

export function isSkillRunInFlight(run: SkillRun | null | undefined): boolean {
  return Boolean(
    run && SKILL_IN_FLIGHT_STATUSES.includes(run.status as SkillRunStatus),
  );
}

export function isAgentAwaitingConfirm(run: AgentRun | null | undefined): boolean {
  return run?.status === "waiting_confirm";
}

export function isAgentRunInFlight(run: AgentRun | null | undefined): boolean {
  return Boolean(
    run && AGENT_IN_FLIGHT_STATUSES.includes(run.status as AgentRunStatus),
  );
}

/** 返回校验失败文案；通过则 null */
export function validateSkillSubmitInput(
  prompt: string,
  productAssetId?: string,
): string | null {
  if (prompt.trim().length < 10) {
    return "请填写至少 10 字的产品卖点/描述";
  }
  if (!productAssetId) {
    return "请先上传商品图（上传附件或产品图）";
  }
  return null;
}

export type OrchestrationSkillSubmitResult =
  | "confirm"
  | "in_flight"
  | "started"
  | "validation_failed";

export async function submitSkillOrchestration(input: {
  prompt: string;
  activeSkillId: string;
  productAssetId?: string;
  referenceAssetId?: string;
  skillRun: SkillRun | null | undefined;
  ensureSession: () => Promise<unknown>;
  confirmRun: () => Promise<unknown>;
  startRun: (
    skillId: string,
    payload: {
      prompt: string;
      productAssetId?: string;
      referenceAssetId?: string;
    },
  ) => Promise<unknown>;
  onValidationError?: (message: string) => void;
  onStarted?: () => void;
}): Promise<OrchestrationSkillSubmitResult> {
  const validationError = validateSkillSubmitInput(
    input.prompt,
    input.productAssetId,
  );
  if (validationError) {
    input.onValidationError?.(validationError);
    return "validation_failed";
  }

  if (isSkillAwaitingConfirm(input.skillRun)) {
    await input.ensureSession();
    await input.confirmRun();
    return "confirm";
  }
  if (isSkillRunInFlight(input.skillRun)) {
    return "in_flight";
  }

  await input.ensureSession();
  await input.startRun(input.activeSkillId, {
    prompt: input.prompt,
    productAssetId: input.productAssetId,
    referenceAssetId: input.referenceAssetId,
  });
  input.onStarted?.();
  return "started";
}

export type OrchestrationAgentSubmitResult =
  | "confirm"
  | "in_flight"
  | "started";

export async function submitAgentOrchestration(input: {
  prompt: string;
  agentRun: AgentRun | null | undefined;
  ensureSession: () => Promise<unknown>;
  confirmRun: () => Promise<unknown>;
  startRun: (prompt: string) => Promise<unknown>;
  onStarted?: () => void;
}): Promise<OrchestrationAgentSubmitResult> {
  if (isAgentAwaitingConfirm(input.agentRun)) {
    await input.ensureSession();
    await input.confirmRun();
    return "confirm";
  }
  if (isAgentRunInFlight(input.agentRun)) {
    return "in_flight";
  }

  await input.ensureSession();
  await input.startRun(input.prompt);
  input.onStarted?.();
  return "started";
}

export type OrchestrationDramaSubmitResult =
  | "confirm"
  | "in_flight"
  | "planned"
  | "started"
  | "validation_failed";

export async function submitDramaOrchestration(input: {
  prompt: string;
  dramaRun: import("@/lib/types").DramaRun | null | undefined;
  planRunState?: { status: string } | null;
  hasDraft: boolean;
  ensureSession: () => Promise<unknown>;
  confirmRun: () => Promise<unknown>;
  planRun: (idea: string) => Promise<unknown>;
  startFromDraft: () => Promise<unknown>;
  startFullRun: (idea: string) => Promise<unknown>;
  onValidationError?: (message: string) => void;
  onStarted?: () => void;
}): Promise<OrchestrationDramaSubmitResult> {
  if (input.prompt.trim().length < 10) {
    input.onValidationError?.("请填写至少 10 字的短剧创意");
    return "validation_failed";
  }

  if (input.dramaRun?.status === "waiting_confirm") {
    await input.ensureSession();
    await input.confirmRun();
    return "confirm";
  }

  if (
    input.dramaRun &&
    ["queued", "running", "waiting_job", "planning"].includes(input.dramaRun.status)
  ) {
    return "in_flight";
  }

  if (input.planRunState?.status === "planning") {
    return "in_flight";
  }

  await input.ensureSession();

  if (input.hasDraft) {
    await input.startFromDraft();
    input.onStarted?.();
    return "started";
  }

  await input.planRun(input.prompt);
  return "planned";
}
