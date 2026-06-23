"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CreationMode } from "@aimarket/ui";
import { ensureSession, fetchAgentPlan, fetchDramaRun, fetchDramaSessionState, trackEvent } from "@/lib/api-client";
import {
  buildOrchestrationTimelineEvent,
  buildDramaPlanTimelineEvent,
  buildDramaRunTimelineEvent,
  type OrchestrationTimelineActions,
  type OrchestrationTimelineEvent,
} from "@/lib/canvas-timeline";
import { useAgentRun } from "@/hooks/use-agent-run";
import { useDramaRun } from "@/hooks/use-drama-run";
import { useDramaPlan, type DramaPlanRunState } from "@/hooks/use-drama-plan";
import { useSkillRun } from "@/hooks/use-skill-run";
import type { AgentPlan, AgentRun, DramaRun, SkillRun } from "@/lib/types";
import {
  defaultCreationLaneForScope,
  type CreationLane,
} from "@/lib/creation-dock-prefs";
import { shouldOrchestrationHandleSubmit } from "@/lib/creation-lane-submit";
import {
  submitAgentOrchestration,
  submitDramaOrchestration,
  submitSkillOrchestration,
} from "@/lib/creation-orchestration-submit";
import { DRAMA_SKILL_ID } from "@/components/creation-dock-controls";
import { useAuth } from "@/lib/auth-context";
import { toApiCreationMode } from "@/lib/modes";

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
  studioMode: CreationMode;
  agentRun: AgentRun | null;
  skillRun: SkillRun | null;
  dramaRun: DramaRun | null;
  dramaRunGraph: ReturnType<typeof useDramaRun>["runGraph"];
  dramaDraftProject: ReturnType<typeof useDramaRun>["draftProject"];
  dramaPlanRun: DramaPlanRunState | null;
  saveDramaDraft: ReturnType<typeof useDramaRun>["saveDraftProject"];
  agentBusy: boolean;
  skillBusy: boolean;
  dramaBusy: boolean;
  dramaPlanBusy: boolean;
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
  rerunDramaPlan: (fromAgent: string, projectPatch?: Record<string, unknown>) => Promise<unknown>;
  dramaAutoProduce: boolean;
  setDramaAutoProduce: (value: boolean) => void;
  dramaTargetDurationSec: number;
  setDramaTargetDurationSec: (value: number) => void;
  dramaAspectRatio: "9:16" | "16:9";
  setDramaAspectRatio: (value: "9:16" | "16:9") => void;
  dramaProduceHint: string | null;
  retryDramaProduction: (fromStep?: string) => Promise<DramaRun | null>;
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
    creationLane: defaultCreationLaneForScope("studio"),
    activeSkillId: null,
    effectiveMode: mode,
    focusEditActive: false,
  });
  const timelineSessionRef = useRef(sessionId);
  const [agentPreviewPlan, setAgentPreviewPlan] = useState<AgentPlan | null>(
    null,
  );
  const [agentPreviewLoading, setAgentPreviewLoading] = useState(false);
  const [persistedTimeline, setPersistedTimeline] =
    useState<OrchestrationTimelineEvent | null>(null);
  const [orchestrationResetTick, setOrchestrationResetTick] = useState(0);
  const [dramaAutoProduce, setDramaAutoProduce] = useState(false);
  const [dramaTargetDurationSec, setDramaTargetDurationSec] = useState(90);
  const [dramaAspectRatio, setDramaAspectRatio] = useState<"9:16" | "16:9">(
    "9:16",
  );
  const [dramaProduceHint, setDramaProduceHint] = useState<string | null>(null);

  const handleOrchestrationCompleted = useCallback(() => {
    onClearPrompt?.();
    setOrchestrationResetTick((t) => t + 1);
  }, [onClearPrompt]);

  const {
    run: dramaRun,
    runGraph: dramaRunGraph,
    draftProject: dramaDraftProject,
    busy: dramaBusy,
    planOnly: planDramaOnly,
    startProduction: startDramaProduction,
    confirmRun: confirmDramaRunAction,
    cancelRun: cancelDramaRunAction,
    saveDraftProject: saveDramaDraft,
    retryProduction: retryDramaProductionAction,
    setRun: setDramaRun,
    setDraftProject: setDramaDraftProject,
  } = useDramaRun({
    sessionId,
    enabled: orchestrationEnabled,
    onJobStarted,
    onRunSettled: (run) => {
      if (run.status === "failed" && run.error) {
        setDramaProduceHint(run.error);
      } else if (run.status === "completed") {
        setDramaProduceHint(null);
      }
      if (run.status === "completed") {
        void refreshUser();
        void trackEvent("drama_run_complete", { sessionId, runId: run.id });
        handleOrchestrationCompleted();
      }
      onRunSettled?.();
    },
  });

  const {
    planRun: dramaPlanRun,
    events: dramaPlanEvents,
    busy: dramaPlanBusy,
    startPlan: startDramaPlan,
    rerunPlan: rerunDramaPlan,
    cancelWatch: cancelDramaPlanWatch,
    resetPlan: resetDramaPlan,
    restorePlan: restoreDramaPlan,
  } = useDramaPlan({
    sessionId,
    enabled: orchestrationEnabled,
    onComplete: (project, _estimatedPoints, dramaRunId, produceSkippedReason) => {
      setDramaDraftProject(project);
      if (dramaRunId) {
        void fetchDramaRun(dramaRunId).then((run) => {
          setDramaRun(run);
          if (run.status === "failed" && run.error) {
            setDramaProduceHint(run.error);
          }
        });
      }
      if (produceSkippedReason) {
        setDramaProduceHint(produceSkippedReason);
      }
    },
    onFailed: (error) => setDramaProduceHint(error),
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

  const orchestrationResetKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const resetKey = `${sessionId}:${mode}`;
    if (orchestrationResetKeyRef.current === resetKey) return;
    orchestrationResetKeyRef.current = resetKey;
    resetAgentRun();
    resetSkillRun();
    setDramaRun(null);
    setDramaDraftProject(null);
    setDramaProduceHint(null);
    setDramaAutoProduce(false);
    setAgentPreviewPlan(null);
    setPersistedTimeline(null);
    setInput((prev) => ({
      ...prev,
      prompt: "",
      activeSkillId: mode === "production" ? DRAMA_SKILL_ID : null,
      effectiveMode: mode,
      focusEditActive: false,
      ...(mode === "production" ? { creationLane: "agent" as const } : {}),
    }));
    setOrchestrationResetTick((t) => t + 1);
    cancelDramaPlanWatch();
    resetDramaPlan();
  }, [
    sessionId,
    mode,
    resetAgentRun,
    resetSkillRun,
    setDramaRun,
    setDramaDraftProject,
    cancelDramaPlanWatch,
    resetDramaPlan,
  ]);

  useEffect(() => {
    if (!orchestrationEnabled || !sessionId) return;
    let cancelled = false;

    void fetchDramaSessionState(sessionId).then((state) => {
      if (cancelled) return;

      if (state.dramaRun) {
        setDramaRun(state.dramaRun);
        setInput((prev) => ({
          ...prev,
          activeSkillId: DRAMA_SKILL_ID,
          creationLane: "agent",
        }));
        if (state.dramaRun.status === "failed" && state.dramaRun.error) {
          setDramaProduceHint(state.dramaRun.error);
        } else if (state.dramaRun.status === "waiting_confirm") {
          setDramaProduceHint(null);
        }
      }

      if (state.draftProject) {
        setDramaDraftProject(state.draftProject);
        setInput((prev) => ({
          ...prev,
          activeSkillId: DRAMA_SKILL_ID,
          creationLane: "agent",
        }));
      }

      if (state.planRun) {
        restoreDramaPlan(state.planRun);
        if (state.planRun.userIdea) {
          setInput((prev) => ({
            ...prev,
            prompt: state.planRun!.userIdea,
            activeSkillId: DRAMA_SKILL_ID,
            creationLane: "agent",
          }));
        } else {
          setInput((prev) => ({
            ...prev,
            activeSkillId: DRAMA_SKILL_ID,
            creationLane: "agent",
          }));
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    sessionId,
    orchestrationEnabled,
    setDramaRun,
    setDramaDraftProject,
    restoreDramaPlan,
  ]);

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
      void fetchAgentPlan({
        prompt: prompt.trim(),
        mode: toApiCreationMode(effectiveMode),
      })
        .then(setAgentPreviewPlan)
        .catch(() => setAgentPreviewPlan(null))
        .finally(() => setAgentPreviewLoading(false));
    }, 500);
    return () => window.clearTimeout(t);
  }, [input, agentRun]);

  const agentSkillTimeline = useMemo(
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

  const dramaRunTimeline = useMemo(() => {
    if (!dramaRun) return null;
    if (dramaPlanRun?.status === "planning") return null;
    return buildDramaRunTimelineEvent({
      run: dramaRun,
      prompt: input.prompt,
    });
  }, [dramaRun, dramaPlanRun?.status, input.prompt]);

  const dramaPlanTimeline = useMemo(() => {
    if (!dramaPlanRun) return null;
    if (dramaPlanRun.status === "completed") {
      return buildDramaPlanTimelineEvent({
        planRunId: dramaPlanRun.id,
        status: "completed",
        prompt: input.prompt,
        currentAgent: dramaPlanRun.currentAgent,
        events: dramaPlanEvents,
        error: dramaPlanRun.error,
      });
    }
    if (dramaPlanRun.status === "failed" || dramaPlanRun.status === "planning") {
      return buildDramaPlanTimelineEvent({
        planRunId: dramaPlanRun.id,
        status: dramaPlanRun.status,
        prompt: input.prompt,
        currentAgent: dramaPlanRun.currentAgent,
        events: dramaPlanEvents,
        error: dramaPlanRun.error,
      });
    }
    return null;
  }, [dramaPlanRun, dramaPlanEvents, input.prompt]);

  const timelineEvent = dramaRunTimeline ?? dramaPlanTimeline ?? agentSkillTimeline;

  useEffect(() => {
    if (timelineSessionRef.current !== sessionId) {
      timelineSessionRef.current = sessionId;
      setPersistedTimeline(null);
      return;
    }
    setPersistedTimeline((prev) => {
      if (timelineEvent) return timelineEvent;
      if (prev?.runType === "drama_plan") return null;
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
  }, [timelineEvent, sessionId]);

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
          planRunState: dramaPlanRun,
          hasDraft: Boolean(dramaDraftProject),
          ensureSession: () => ensureSession(sessionId, effectiveMode),
          confirmRun: confirmOrchestration,
          planRun: (idea) =>
            startDramaPlan(idea, {
              targetDurationSec: dramaTargetDurationSec,
              aspectRatio: dramaAspectRatio,
              autoProduce: dramaAutoProduce,
            }).then(() => undefined),
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
      dramaRunGraph,
      dramaDraftProject,
      confirmOrchestration,
      startSkillRun,
      startAgentRun,
      planDramaOnly,
      startDramaPlan,
      startDramaProduction,
      dramaAutoProduce,
      dramaPlanRun,
      dramaTargetDurationSec,
      dramaAspectRatio,
    ],
  );

  const retryDramaProduction = useCallback(
    async (fromStep?: string) => {
      setDramaProduceHint(null);
      return retryDramaProductionAction(fromStep);
    },
    [retryDramaProductionAction],
  );

  const handleRerunFromAgent = useCallback(
    (fromAgent: string) => {
      void rerunDramaPlan(fromAgent);
    },
    [rerunDramaPlan],
  );

  const timelineActions = useMemo((): OrchestrationTimelineActions | null => {
    if (!persistedTimeline && !timelineEvent) return null;
    return {
      onConfirm: () => void confirmOrchestration(),
      onCancel: () => void cancelOrchestration(),
      onRerunFromAgent:
        dramaPlanRun?.status === "completed" ||
        dramaPlanRun?.status === "failed"
          ? handleRerunFromAgent
          : undefined,
      confirmBusy: agentBusy || skillBusy || dramaBusy || dramaPlanBusy,
      readOnly,
    };
  }, [
    persistedTimeline,
    timelineEvent,
    confirmOrchestration,
    cancelOrchestration,
    handleRerunFromAgent,
    dramaPlanRun?.status,
    agentBusy,
    skillBusy,
    dramaBusy,
    dramaPlanBusy,
    readOnly,
  ]);

  const value = useMemo(
    (): StudioOrchestrationContextValue => ({
      sessionId,
      studioMode: mode,
      agentRun,
      skillRun,
      dramaRun,
      dramaRunGraph,
      dramaDraftProject,
      dramaPlanRun,
      saveDramaDraft,
      agentBusy,
      skillBusy,
      dramaBusy,
      dramaPlanBusy,
      setDramaRun,
      skillPackages,
      startAgentRun,
      startSkillRun,
      timelineEvent: persistedTimeline ?? timelineEvent,
      timelineActions,
      setInput,
      confirmOrchestration,
      produceDramaDraft,
      rerunDramaPlan,
      dramaAutoProduce,
      setDramaAutoProduce,
      dramaTargetDurationSec,
      setDramaTargetDurationSec,
      dramaAspectRatio,
      setDramaAspectRatio,
      dramaProduceHint,
      retryDramaProduction,
      cancelOrchestration,
      dispatchSubmit,
      orchestrationResetTick,
    }),
    [
      sessionId,
      mode,
      agentRun,
      skillRun,
      dramaRun,
      dramaRunGraph,
      dramaDraftProject,
      dramaPlanRun,
      saveDramaDraft,
      agentBusy,
      skillBusy,
      dramaBusy,
      dramaPlanBusy,
      setDramaRun,
      skillPackages,
      startAgentRun,
      startSkillRun,
      persistedTimeline,
      timelineEvent,
      timelineActions,
      confirmOrchestration,
      produceDramaDraft,
      rerunDramaPlan,
      dramaAutoProduce,
      setDramaAutoProduce,
      dramaTargetDurationSec,
      setDramaTargetDurationSec,
      dramaAspectRatio,
      setDramaAspectRatio,
      dramaProduceHint,
      retryDramaProduction,
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
