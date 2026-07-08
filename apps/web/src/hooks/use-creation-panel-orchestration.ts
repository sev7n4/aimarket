"use client";

import type { MutableRefObject } from "react";
import { useEffect, useRef } from "react";

import type { CreationMode } from "@aimarket/ui";
import { useAgentRun } from "@/hooks/use-agent-run";
import { useSkillRun } from "@/hooks/use-skill-run";
import { ECOMMERCE_SET_SKILL_ID } from "@/components/creation-dock-controls";
import type { StudioOrchestrationContextValue } from "@/components/studio-orchestration-provider";
import type { CreationLane } from "@/lib/creation-dock-prefs";
import {
  isAgentAwaitingConfirm,
  isAgentRunInFlight,
  isSkillAwaitingConfirm,
  isSkillRunInFlight,
} from "@/lib/creation-orchestration-submit";
import type {
  AgentRunStatus,
  AgentSkillPublic,
  SkillRunStatus,
} from "@/lib/types";
import { trackEvent } from "@/lib/api/studio";
import type { CanvasMaskSelection } from "@/lib/canvas-tools";

export type UseCreationPanelOrchestrationInput = {
  sessionId?: string;
  effectiveMode: CreationMode;
  skillsEnabled: boolean;
  agentEnabled: boolean;
  studioOrchestrationActive: boolean;
  studioOrch: StudioOrchestrationContextValue | null;
  dramaOrchestrationActive: boolean;
  creationLane: CreationLane;
  activeSkillId: string | null;
  selectedSkillId: string | null;
  prompt: string;
  setPrompt: (p: string | ((prev: string) => string)) => void;
  focusEditActive: boolean;
  sessionEnsuredRef: MutableRefObject<boolean>;
  clearAttachmentState: () => void;
  setMentionedMasks: React.Dispatch<React.SetStateAction<CanvasMaskSelection[]>>;
  setSelectedSkillId: (id: string | null) => void;
  setDockSkillId: (id: string | null) => void;
  refreshUser: () => Promise<void>;
  onJobStarted?: (jobId: string) => void;
  onAgentRunComplete?: () => void;
};

export function useCreationPanelOrchestration(
  input: UseCreationPanelOrchestrationInput,
) {
  const {
    sessionId,
    effectiveMode,
    skillsEnabled,
    agentEnabled,
    studioOrchestrationActive,
    studioOrch,
    dramaOrchestrationActive,
    creationLane,
    activeSkillId,
    selectedSkillId,
    prompt,
    setPrompt,
    focusEditActive,
    sessionEnsuredRef,
    clearAttachmentState,
    setMentionedMasks,
    setSelectedSkillId,
    setDockSkillId,
    refreshUser,
    onJobStarted,
    onAgentRunComplete,
  } = input;

  const {
    skills: skillPackages,
    run: skillRun,
    busy: skillBusy,
    startRun: startSkillRun,
    confirmRun: confirmSkillRunAction,
    cancelRun: cancelSkillRunAction,
    resetRun: resetSkillRun,
  } = useSkillRun({
    sessionId,
    enabled: skillsEnabled && !studioOrchestrationActive,
    onJobStarted,
    onRunSettled: (run) => {
      if (run.status === "completed") {
        setPrompt("");
        clearAttachmentState();
        setMentionedMasks([]);
        setSelectedSkillId(null);
        setDockSkillId(null);
        void refreshUser();
        void trackEvent("skill_run_complete", {
          sessionId: sessionId ?? "",
          runId: run.id,
          skillId: run.skillId,
        });
      } else if (run.status === "failed" && run.error) {
        alert(run.error);
      }
      onAgentRunComplete?.();
      resetSkillRun();
    },
  });

  const {
    run: agentRun,
    busy: agentBusy,
    startRun: startAgentRun,
    confirmRun: confirmAgentRunAction,
    cancelRun: cancelAgentRunAction,
    resetRun: resetAgentRun,
  } = useAgentRun({
    sessionId,
    mode: effectiveMode,
    enabled: agentEnabled && !studioOrchestrationActive,
    onJobStarted,
    onRunSettled: (run) => {
      if (run.status === "completed") {
        setPrompt("");
        clearAttachmentState();
        setMentionedMasks([]);
        void refreshUser();
        void trackEvent("agent_run_complete", {
          sessionId: sessionId ?? "",
          runId: run.id,
        });
      } else if (run.status === "failed" && run.error) {
        alert(run.error);
      }
      onAgentRunComplete?.();
      resetAgentRun();
    },
  });

  const orchSkillRun = studioOrchestrationActive
    ? studioOrch!.skillRun
    : skillRun;
  const orchAgentRun = studioOrchestrationActive
    ? studioOrch!.agentRun
    : agentRun;
  const orchSkillBusy = studioOrchestrationActive
    ? studioOrch!.skillBusy
    : skillBusy;
  const orchAgentBusy = studioOrchestrationActive
    ? studioOrch!.agentBusy
    : agentBusy;

  const selectedSkill: AgentSkillPublic | null =
    (studioOrchestrationActive ? studioOrch!.skillPackages : skillPackages).find(
      (s) => s.id === (activeSkillId ?? selectedSkillId),
    ) ?? null;

  const sessionResetKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const resetKey = sessionId ?? "";
    if (sessionResetKeyRef.current === resetKey) return;
    sessionResetKeyRef.current = resetKey;
    sessionEnsuredRef.current = false;
    if (!studioOrchestrationActive) {
      resetAgentRun();
      resetSkillRun();
    }
    setPrompt("");
    clearAttachmentState();
    setMentionedMasks([]);
    setSelectedSkillId(null);
    setDockSkillId(null);
  }, [
    sessionId,
    resetAgentRun,
    resetSkillRun,
    studioOrchestrationActive,
    setPrompt,
    clearAttachmentState,
    sessionEnsuredRef,
    setMentionedMasks,
    setSelectedSkillId,
    setDockSkillId,
  ]);

  useEffect(() => {
    if (!studioOrchestrationActive || !studioOrch) return;
    studioOrch.setInput({
      prompt,
      creationLane,
      activeSkillId,
      effectiveMode,
      focusEditActive,
    });
  }, [
    studioOrchestrationActive,
    studioOrch,
    prompt,
    creationLane,
    activeSkillId,
    effectiveMode,
    focusEditActive,
  ]);

  const orchestrationResetTick = studioOrch?.orchestrationResetTick ?? 0;
  const lastOrchestrationResetRef = useRef(0);
  useEffect(() => {
    if (!studioOrchestrationActive) return;
    if (orchestrationResetTick <= lastOrchestrationResetRef.current) return;
    lastOrchestrationResetRef.current = orchestrationResetTick;
    setPrompt("");
    clearAttachmentState();
    setMentionedMasks([]);
    setSelectedSkillId(null);
    setDockSkillId(null);
  }, [
    studioOrchestrationActive,
    orchestrationResetTick,
    setPrompt,
    clearAttachmentState,
    setMentionedMasks,
    setSelectedSkillId,
    setDockSkillId,
  ]);

  const skillAwaitingConfirm = isSkillAwaitingConfirm(orchSkillRun);
  const skillInFlight = isSkillRunInFlight(orchSkillRun);
  const skillIdle =
    !orchSkillRun ||
    (["completed", "failed", "cancelled"] as SkillRunStatus[]).includes(
      orchSkillRun.status,
    );

  const agentAwaitingConfirm = isAgentAwaitingConfirm(orchAgentRun);
  const agentInFlight = isAgentRunInFlight(orchAgentRun);
  const agentIdle =
    !orchAgentRun ||
    (["completed", "failed", "cancelled"] as AgentRunStatus[]).includes(
      orchAgentRun.status,
    );

  const submitAriaLabel = skillAwaitingConfirm
    ? "确认执行套餐"
    : agentAwaitingConfirm
      ? "确认执行"
      : creationLane === "agent"
        ? dramaOrchestrationActive
          ? "开始规划"
          : "提交 Agent"
        : activeSkillId === ECOMMERCE_SET_SKILL_ID
          ? "开始电商套图"
          : activeSkillId
            ? "开始套餐"
            : "开始生成";

  return {
    skillPackages,
    skillRun,
    skillBusy,
    startSkillRun,
    confirmSkillRunAction,
    cancelSkillRunAction,
    agentRun,
    agentBusy,
    startAgentRun,
    confirmAgentRunAction,
    cancelAgentRunAction,
    selectedSkill,
    orchSkillRun,
    orchAgentRun,
    orchSkillBusy,
    orchAgentBusy,
    skillAwaitingConfirm,
    skillInFlight,
    skillIdle,
    agentAwaitingConfirm,
    agentInFlight,
    agentIdle,
    submitAriaLabel,
  };
}
