"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CreationMode } from "@aimarket/ui";
import { fetchAgentPlan, trackEvent } from "@/lib/api-client";
import {
  buildOrchestrationTimelineEvent,
  type OrchestrationTimelineActions,
  type OrchestrationTimelineEvent,
} from "@/lib/canvas-timeline";
import { useAgentRun } from "@/hooks/use-agent-run";
import { useSkillRun } from "@/hooks/use-skill-run";
import type { AgentPlan, AgentRun, SkillRun } from "@/lib/types";
import type { CreationLane } from "@/lib/creation-dock-prefs";
import { useAuth } from "@/lib/auth-context";

export interface StudioOrchestrationInput {
  prompt: string;
  creationLane: CreationLane;
  activeSkillId: string | null;
  effectiveMode: CreationMode;
  focusEditActive: boolean;
}

interface StudioOrchestrationContextValue {
  agentRun: AgentRun | null;
  skillRun: SkillRun | null;
  agentBusy: boolean;
  skillBusy: boolean;
  skillPackages: ReturnType<typeof useSkillRun>["skills"];
  startAgentRun: (prompt: string) => Promise<AgentRun | null>;
  startSkillRun: (
    skillId: string,
    input: {
      prompt: string;
      productAssetId?: string;
      referenceAssetId?: string;
    },
  ) => Promise<SkillRun | null>;
  confirmOrchestration: () => Promise<AgentRun | SkillRun | null>;
  cancelOrchestration: () => Promise<void>;
  timelineEvent: OrchestrationTimelineEvent | null;
  timelineActions: OrchestrationTimelineActions | null;
  setInput: (input: StudioOrchestrationInput) => void;
}

const StudioOrchestrationContext =
  createContext<StudioOrchestrationContextValue | null>(null);

export function useStudioOrchestration(): StudioOrchestrationContextValue {
  const ctx = useContext(StudioOrchestrationContext);
  if (!ctx) {
    throw new Error("useStudioOrchestration must be used within StudioOrchestrationProvider");
  }
  return ctx;
}

export function useStudioOrchestrationOptional(): StudioOrchestrationContextValue | null {
  return useContext(StudioOrchestrationContext);
}

interface StudioOrchestrationProviderProps {
  sessionId: string;
  mode: CreationMode;
  readOnly: boolean;
  onJobStarted?: (jobId: string) => void;
  onRunSettled?: () => void;
  children: ReactNode;
}

export function StudioOrchestrationProvider({
  sessionId,
  mode,
  readOnly,
  onJobStarted,
  onRunSettled,
  children,
}: StudioOrchestrationProviderProps) {
  const { refreshUser } = useAuth();
  const [input, setInput] = useState<StudioOrchestrationInput>({
    prompt: "",
    creationLane: "agent",
    activeSkillId: null,
    effectiveMode: mode,
    focusEditActive: false,
  });
  const [agentPreviewPlan, setAgentPreviewPlan] = useState<AgentPlan | null>(null);
  const [agentPreviewLoading, setAgentPreviewLoading] = useState(false);
  const [persistedTimeline, setPersistedTimeline] =
    useState<OrchestrationTimelineEvent | null>(null);

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
    enabled: true,
    onJobStarted,
    onRunSettled: (run) => {
      if (run.status === "failed" && run.error) alert(run.error);
      if (run.status === "completed") {
        void refreshUser();
        void trackEvent("skill_run_complete", {
          sessionId,
          runId: run.id,
          skillId: run.skillId,
        });
      }
      onRunSettled?.();
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
    mode: input.effectiveMode,
    enabled: true,
    onJobStarted,
    onRunSettled: (run) => {
      if (run.status === "failed" && run.error) alert(run.error);
      if (run.status === "completed") {
        void refreshUser();
        void trackEvent("agent_run_complete", { sessionId, runId: run.id });
      }
      onRunSettled?.();
      resetAgentRun();
    },
  });

  useEffect(() => {
    resetAgentRun();
    resetSkillRun();
    setAgentPreviewPlan(null);
    setPersistedTimeline(null);
  }, [sessionId, resetAgentRun, resetSkillRun]);

  useEffect(() => {
    const {
      prompt,
      creationLane,
      activeSkillId,
      effectiveMode,
      focusEditActive,
    } = input;
    if (
      creationLane !== "agent" ||
      activeSkillId ||
      agentRun ||
      focusEditActive ||
      !prompt.trim()
    ) {
      setAgentPreviewPlan(null);
      setAgentPreviewLoading(false);
      return;
    }
    setAgentPreviewLoading(true);
    const t = window.setTimeout(() => {
      void fetchAgentPlan({ prompt: prompt.trim(), mode: effectiveMode })
        .then(setAgentPreviewPlan)
        .catch(() => setAgentPreviewPlan(null))
        .finally(() => setAgentPreviewLoading(false));
    }, 500);
    return () => window.clearTimeout(t);
  }, [input, agentRun]);

  const timelineEvent = useMemo(
    () =>
      buildOrchestrationTimelineEvent({
        agentRun,
        skillRun,
        agentPreviewPlan,
        agentPreviewLoading,
        prompt: input.prompt,
      }),
    [agentRun, skillRun, agentPreviewPlan, agentPreviewLoading, input.prompt],
  );

  useEffect(() => {
    setPersistedTimeline((prev) => {
      if (timelineEvent) return timelineEvent;
      if (
        prev &&
        (prev.status === "completed" ||
          prev.status === "failed" ||
          prev.status === "cancelled")
      ) {
        return prev;
      }
      return null;
    });
  }, [timelineEvent]);

  const cancelOrchestration = useCallback(async () => {
    if (skillRun) await cancelSkillRunAction();
    else if (agentRun) await cancelAgentRunAction();
  }, [skillRun, agentRun, cancelSkillRunAction, cancelAgentRunAction]);

  const confirmOrchestration = useCallback(async () => {
    if (skillRun?.status === "waiting_confirm") {
      return confirmSkillRunAction();
    }
    if (agentRun?.status === "waiting_confirm") {
      return confirmAgentRunAction();
    }
    return null;
  }, [
    skillRun?.status,
    agentRun?.status,
    confirmSkillRunAction,
    confirmAgentRunAction,
  ]);

  const timelineActions = useMemo((): OrchestrationTimelineActions | null => {
    if (!persistedTimeline && !timelineEvent) return null;
    return {
      onConfirm: () => void confirmOrchestration(),
      onCancel: () => void cancelOrchestration(),
      confirmBusy: agentBusy || skillBusy,
      readOnly,
    };
  }, [
    persistedTimeline,
    timelineEvent,
    confirmOrchestration,
    cancelOrchestration,
    agentBusy,
    skillBusy,
    readOnly,
  ]);

  const value = useMemo(
    (): StudioOrchestrationContextValue => ({
      agentRun,
      skillRun,
      agentBusy,
      skillBusy,
      skillPackages,
      startAgentRun,
      startSkillRun,
      timelineEvent: persistedTimeline ?? timelineEvent,
      timelineActions,
      setInput,
      confirmOrchestration,
      cancelOrchestration,
    }),
    [
      agentRun,
      skillRun,
      agentBusy,
      skillBusy,
      skillPackages,
      startAgentRun,
      startSkillRun,
      persistedTimeline,
      timelineEvent,
      timelineActions,
      confirmOrchestration,
      cancelOrchestration,
    ],
  );

  return (
    <StudioOrchestrationContext.Provider value={value}>
      {children}
    </StudioOrchestrationContext.Provider>
  );
}
