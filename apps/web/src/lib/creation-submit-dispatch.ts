import type { CreationMode } from "@aimarket/ui";

import { ensureSession } from "@/lib/api-client";
import type { PendingBatchLineage } from "@/lib/canvas-tools";
import type { CreationLane } from "@/lib/creation-dock-prefs";
import type { SubmitPath } from "@/lib/creation-lane-submit";
import {
  submitAgentOrchestration,
  submitSkillOrchestration,
  type OrchestrationAgentSubmitResult,
  type OrchestrationSkillSubmitResult,
} from "@/lib/creation-orchestration-submit";
import type { AgentRun, SkillRun } from "@/lib/types";
import {
  submitStudioDirectGeneration,
  type StudioDirectGenerationInput,
} from "@/lib/studio-submit";

export type DispatchCreationSubmitInput = {
  submitPath: SubmitPath;
  sessionId: string;
  mode: CreationMode;
  effectiveMode: CreationMode;
  prompt: string;
  creationLane: CreationLane;
  activeSkillId: string | null;
  focusEditActive: boolean;
  mentionedMasksCount: number;
  submitVideo: boolean;
  hasReferenceImages: boolean;
  productAssetId?: string | null;
  referenceAssetId?: string | null;
  agentRun: AgentRun | null | undefined;
  skillRun: SkillRun | null | undefined;
  confirmAgentRun: () => Promise<unknown>;
  startAgentRun: (prompt: string) => Promise<unknown>;
  confirmSkillRun: () => Promise<unknown>;
  startSkillRun: (
    skillId: string,
    payload: {
      prompt: string;
      productAssetId?: string;
      referenceAssetId?: string;
    },
  ) => Promise<unknown>;
  directGeneration: Omit<StudioDirectGenerationInput, "sessionId" | "mode" | "prompt" | "creationLane">;
  onAlert?: (message: string) => void;
  onAgentStarted?: () => void;
  onSkillStarted?: () => void;
};

export type DispatchCreationSubmitResult =
  | { kind: "skill"; result: OrchestrationSkillSubmitResult }
  | { kind: "agent"; result: OrchestrationAgentSubmitResult }
  | {
      kind: "direct";
      jobId: string;
      lineage?: PendingBatchLineage;
      routeReason?: string;
      byokActive?: boolean;
    }
  | { kind: "unhandled" };

/** 创作提交执行单入口：Skill / Agent / 直接生成 */
export async function dispatchCreationSubmit(
  input: DispatchCreationSubmitInput,
): Promise<DispatchCreationSubmitResult> {
  const {
    submitPath,
    sessionId,
    mode,
    prompt,
    activeSkillId,
    productAssetId,
    referenceAssetId,
    agentRun,
    skillRun,
    confirmAgentRun,
    startAgentRun,
    confirmSkillRun,
    startSkillRun,
    directGeneration,
    onAlert = (message) => alert(message),
    onAgentStarted,
    onSkillStarted,
  } = input;

  if (submitPath === "skill" && activeSkillId) {
    const result = await submitSkillOrchestration({
      prompt,
      activeSkillId,
      productAssetId: productAssetId ?? undefined,
      referenceAssetId: referenceAssetId ?? undefined,
      skillRun,
      ensureSession: () => ensureSession(sessionId, mode),
      confirmRun: confirmSkillRun,
      startRun: startSkillRun,
      onValidationError: onAlert,
      onStarted: onSkillStarted,
    });
    return { kind: "skill", result };
  }

  if (submitPath === "agent" || submitPath === "orchestration") {
    const result = await submitAgentOrchestration({
      prompt,
      agentRun,
      ensureSession: () => ensureSession(sessionId, mode),
      confirmRun: confirmAgentRun,
      startRun: startAgentRun,
      onStarted: onAgentStarted,
    });
    return { kind: "agent", result };
  }

  if (submitPath === "focus-edit") {
    return { kind: "unhandled" };
  }

  const direct = await submitStudioDirectGeneration({
    sessionId,
    mode,
    prompt,
    creationLane: input.creationLane,
    ...directGeneration,
  });
  return {
    kind: "direct",
    jobId: direct.jobId,
    lineage: direct.lineage,
    routeReason: direct.routeReason,
    byokActive: direct.byokActive,
  };
}
