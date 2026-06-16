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
import { useDramaRun } from "@/hooks/use-drama-run";
import { useSkillRun } from "@/hooks/use-skill-run";
import type { AgentPlan, AgentRun, DramaRun, SkillRun } from "@/lib/types";
import type { CreationLane } from "@/lib/creation-dock-prefs";
import { shouldOrchestrationHandleSubmit } from "@/lib/creation-lane-submit";
import {
  submitAgentOrchestration,
  submitDramaOrchestration,
  submitSkillOrchestration,
} from "@/lib/creation-orchestration-submit";
import { DRAMA_SKILL_ID } from "@/components/creation-dock-controls";
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
  sessionId: string;
  agentRun: AgentRun | null;
  skillRun: SkillRun | null;
  dramaRun: DramaRun | null;
  dramaDraftProject: ReturnType<typeof useDramaRun>["draftProject"];
  saveDramaDraft: ReturnType<typeof useDramaRun>["saveDraftProject"];
  agentBusy: boolean;
  skillBusy: boolean;
  dramaBusy: boolean;
  setDramaRun: (run: DramaRun | null) => void;
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
  confirmOrchestration: () => Promise<AgentRun | SkillRun | DramaRun | null>;
  produceDramaDraft: () => Promise<DramaRun | null>;
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
    run: dramaRun,
    draftProject: dramaDraftProject,
    busy: dramaBusy,
    planOnly: planDramaOnly,
    startProduction: startDramaProduction,
    confirmRun: confirmDramaRunAction,
    cancelRun: cancelDramaRunAction,
    saveDraftProject: saveDramaDraft,
    setRun: setDramaRun,
    setDraftProject: setDramaDraftProject,
  } = useDramaRun({
    sessionId,
    enabled: orchestrationEnabled,
    onJobStarted,
    onRunSettled: (run) => {
      if (run.status === "failed" && run.error) alert(run.error);
      if (run.status === "completed") {
        void refreshUser();
        void trackEvent("drama_run_complete", { sessionId, runId: run.id });
        handleOrchestrationCompleted();
      }
      onRunSettled?.();
    },
  });

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
    setDramaRun(null);
    setDramaDraftProject(null);
    setAgentPreviewPlan(null);
    setPersistedTimeline(null);
  }, [sessionId, resetAgentRun, resetSkillRun, setDramaRun, setDramaDraftProject]);

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
    if (dramaRun) await cancelDramaRunAction();
    else if (skillRun) await cancelSkillRunAction();
    else if (agentRun) await cancelAgentRunAction();
  }, [dramaRun, skillRun, agentRun, cancelDramaRunAction, cancelSkillRunAction, cancelAgentRunAction]);

  const confirmOrchestration = useCallback(async () => {
    if (dramaRun?.status === "waiting_confirm") {
      return confirmDramaRunAction();
    }
    if (skillRun?.status === "waiting_confirm") {
      return confirmSkillRunAction();
    }
    if (agentRun?.status === "waiting_confirm") {
      return confirmAgentRunAction();
    }
    return null;
  }, [
    dramaRun?.status,
    skillRun?.status,
    agentRun?.status,
    confirmDramaRunAction,
    confirmSkillRunAction,
    confirmAgentRunAction,
  ]);

  const produceDramaDraft = useCallback(async () => {
    if (!dramaDraftProject?.id) return null;
    return startDramaProduction(dramaDraftProject.id, true);
  }, [dramaDraftProject?.id, startDramaProduction]);

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
          dramaSkillActive: activeSkillId === DRAMA_SKILL_ID,
        })
      ) {
        return false;
      }

      const useDramaSubmit = activeSkillId === DRAMA_SKILL_ID;
      const useSkillSubmit = Boolean(activeSkillId) && !useDramaSubmit;
      const useAgentSubmit =
        creationLane === "agent" && !activeSkillId;

      if (useDramaSubmit) {
        await submitDramaOrchestration({
          prompt,
          dramaRun,
          hasDraft: Boolean(dramaDraftProject),
          ensureSession: () => ensureSession(sessionId, effectiveMode),
          confirmRun: confirmOrchestration,
          planRun: (idea) => planDramaOnly(idea, "9:16"),
          startFromDraft: () =>
            dramaDraftProject
              ? startDramaProduction(dramaDraftProject.id, true)
              : Promise.resolve(),
          startFullRun: (idea) =>
            planDramaOnly(idea, "9:16").then((data) =>
              data ? startDramaProduction(data.project.id, true) : null,
            ),
          onValidationError: (message) => alert(message),
          onStarted: () => {
            void trackEvent("drama_run_start", { sessionId });
          },
        });
        return true;
      }

      if (useSkillSubmit && activeSkillId) {
        await submitSkillOrchestration({
          prompt,
          activeSkillId,
          productAssetId,
          referenceAssetId,
          skillRun,
          ensureSession: () => ensureSession(sessionId, effectiveMode),
          confirmRun: confirmOrchestration,
          startRun: startSkillRun,
          onValidationError: (message) => alert(message),
          onStarted: () => {
            void trackEvent("skill_run_start", {
              sessionId,
              skillId: activeSkillId,
            });
          },
        });
        return true;
      }

      if (useAgentSubmit) {
        await submitAgentOrchestration({
          prompt,
          agentRun,
          ensureSession: () => ensureSession(sessionId, effectiveMode),
          confirmRun: confirmOrchestration,
          startRun: startAgentRun,
          onStarted: () => {
            void trackEvent("agent_run_start", {
              sessionId,
              mode: effectiveMode,
            });
          },
        });
        return true;
      }

      return false;
    },
    [
      sessionId,
      skillRun,
      agentRun,
      dramaRun,
      dramaDraftProject,
      confirmOrchestration,
      startSkillRun,
      startAgentRun,
      planDramaOnly,
      startDramaProduction,
    ],
  );

  const timelineActions = useMemo((): OrchestrationTimelineActions | null => {
    if (!persistedTimeline && !timelineEvent) return null;
    return {
      onConfirm: () => void confirmOrchestration(),
      onCancel: () => void cancelOrchestration(),
      confirmBusy: agentBusy || skillBusy || dramaBusy,
      readOnly,
    };
  }, [
    persistedTimeline,
    timelineEvent,
    confirmOrchestration,
    cancelOrchestration,
    agentBusy,
    skillBusy,
    dramaBusy,
    readOnly,
  ]);

  const value = useMemo(
    (): StudioOrchestrationContextValue => ({
      sessionId,
      agentRun,
      skillRun,
      dramaRun,
      dramaDraftProject,
      saveDramaDraft,
      agentBusy,
      skillBusy,
      dramaBusy,
      setDramaRun,
      skillPackages,
      startAgentRun,
      startSkillRun,
      timelineEvent: persistedTimeline ?? timelineEvent,
      timelineActions,
      setInput,
      confirmOrchestration,
      produceDramaDraft,
      cancelOrchestration,
      dispatchSubmit,
      orchestrationResetTick,
    }),
    [
      sessionId,
      agentRun,
      skillRun,
      dramaRun,
      dramaDraftProject,
      saveDramaDraft,
      agentBusy,
      skillBusy,
      dramaBusy,
      setDramaRun,
      skillPackages,
      startAgentRun,
      startSkillRun,
      persistedTimeline,
      timelineEvent,
      timelineActions,
      confirmOrchestration,
      produceDramaDraft,
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
