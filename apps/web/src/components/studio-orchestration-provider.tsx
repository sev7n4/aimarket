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
import { ensureSession, fetchAgentPlan, trackEvent } from "@/lib/api-client";
import {
  buildOrchestrationTimelineEvent,
  type OrchestrationTimelineActions,
  type OrchestrationTimelineEvent,
} from "@/lib/canvas-timeline";
import { useAgentRun } from "@/hooks/use-agent-run";
import { useSkillRun } from "@/hooks/use-skill-run";
import type { AgentPlan, AgentRun, SkillRun } from "@/lib/types";
import type { CreationLane } from "@/lib/creation-dock-prefs";
import { shouldOrchestrationHandleSubmit } from "@/lib/creation-lane-submit";
import { useAuth } from "@/lib/auth-context";

export interface StudioOrchestrationInput {
  prompt: string;
  creationLane: CreationLane;
  activeSkillId: string | null;
  effectiveMode: CreationMode;
  focusEditActive: boolean;
}

export interface StudioOrchestrationSubmitContext {
  prompt: string;
  creationLane: CreationLane;
  activeSkillId: string | null;
  effectiveMode: CreationMode;
  focusEditActive: boolean;
  mentionedMasksCount: number;
  submitVideo: boolean;
  hasReferenceImages: boolean;
  productAssetId?: string;
  referenceAssetId?: string;
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
  dispatchSubmit: (ctx: StudioOrchestrationSubmitContext) => Promise<boolean>;
  timelineEvent: OrchestrationTimelineEvent | null;
  timelineActions: OrchestrationTimelineActions | null;
  orchestrationResetTick: number;
  setInput: (input: StudioOrchestrationInput) => void;
}

const StudioOrchestrationContext =
  createContext<StudioOrchestrationContextValue | null>(null);

export function useStudioOrchestration(): StudioOrchestrationContextValue {
  const ctx = useContext(StudioOrchestrationContext);
  if (!ctx) {
    throw new Error(
      "useStudioOrchestration must be used within StudioOrchestrationProvider",
    );
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
  onClearPrompt?: () => void;
  children: ReactNode;
}

export function StudioOrchestrationProvider({
  sessionId,
  mode,
  readOnly,
  onJobStarted,
  onRunSettled,
  onClearPrompt,
  children,
}: StudioOrchestrationProviderProps) {
  const { user, refreshUser } = useAuth();
  const orchestrationEnabled = Boolean(user) && !readOnly;
  const [input, setInput] = useState<StudioOrchestrationInput>({
    prompt: "",
    creationLane: "agent",
    activeSkillId: null,
    effectiveMode: mode,
    focusEditActive: false,
  });
  const [agentPreviewPlan, setAgentPreviewPlan] = useState<AgentPlan | null>(
    null,
  );
  const [agentPreviewLoading, setAgentPreviewLoading] = useState(false);
  const [persistedTimeline, setPersistedTimeline] =
    useState<OrchestrationTimelineEvent | null>(null);
  const [orchestrationResetTick, setOrchestrationResetTick] = useState(0);

  const handleOrchestrationCompleted = useCallback(() => {
    onClearPrompt?.();
    setOrchestrationResetTick((t) => t + 1);
  }, [onClearPrompt]);

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
    enabled: orchestrationEnabled,
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
        handleOrchestrationCompleted();
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
    enabled: orchestrationEnabled,
    onJobStarted,
    onRunSettled: (run) => {
      if (run.status === "failed" && run.error) alert(run.error);
      if (run.status === "completed") {
        void refreshUser();
        void trackEvent("agent_run_complete", { sessionId, runId: run.id });
        handleOrchestrationCompleted();
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
    setInput((prev) =>
      prev.effectiveMode === mode ? prev : { ...prev, effectiveMode: mode },
    );
  }, [mode]);

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

  const dispatchSubmit = useCallback(
    async (ctx: StudioOrchestrationSubmitContext): Promise<boolean> => {
      const {
        prompt,
        creationLane,
        activeSkillId,
        effectiveMode,
        focusEditActive,
        mentionedMasksCount,
        submitVideo,
        hasReferenceImages,
        productAssetId,
        referenceAssetId,
      } = ctx;

      if (
        !shouldOrchestrationHandleSubmit({
          creationLane,
          activeSkillId,
          focusEditActive,
          mentionedMasksCount,
          submitVideo,
          hasReferenceImages,
        })
      ) {
        return false;
      }

      const useSkillSubmit = Boolean(activeSkillId);
      const useAgentSubmit =
        creationLane === "agent" && !activeSkillId;

      if (useSkillSubmit && activeSkillId) {
        if (prompt.trim().length < 10) {
          alert("请填写至少 10 字的产品卖点/描述");
          return true;
        }
        if (!productAssetId) {
          alert("请先上传商品图（上传附件或产品图）");
          return true;
        }
        if (skillRun?.status === "waiting_confirm") {
          await ensureSession(sessionId, effectiveMode);
          await confirmOrchestration();
          return true;
        }
        if (
          skillRun &&
          (["queued", "running", "waiting_job"] as const).includes(
            skillRun.status as "queued" | "running" | "waiting_job",
          )
        ) {
          return true;
        }
        await ensureSession(sessionId, effectiveMode);
        await startSkillRun(activeSkillId, {
          prompt,
          productAssetId,
          referenceAssetId,
        });
        void trackEvent("skill_run_start", {
          sessionId,
          skillId: activeSkillId,
        });
        return true;
      }

      if (useAgentSubmit) {
        if (agentRun?.status === "waiting_confirm") {
          await ensureSession(sessionId, effectiveMode);
          await confirmOrchestration();
          return true;
        }
        if (
          agentRun &&
          (["planning", "running", "waiting_job"] as const).includes(
            agentRun.status as "planning" | "running" | "waiting_job",
          )
        ) {
          return true;
        }
        await ensureSession(sessionId, effectiveMode);
        await startAgentRun(prompt);
        void trackEvent("agent_run_start", { sessionId, mode: effectiveMode });
        return true;
      }

      return false;
    },
    [
      sessionId,
      skillRun,
      agentRun,
      confirmOrchestration,
      startSkillRun,
      startAgentRun,
    ],
  );

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
      dispatchSubmit,
      orchestrationResetTick,
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
      dispatchSubmit,
      orchestrationResetTick,
    ],
  );

  return (
    <StudioOrchestrationContext.Provider value={value}>
      {children}
    </StudioOrchestrationContext.Provider>
  );
}
