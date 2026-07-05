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
import { analyzeDramaReplicate, duplicateDramaProject as duplicateDramaProjectApi, ensureSession, fetchAgentPlan, fetchDramaRun, fetchDramaSessionState, trackEvent } from "@/lib/api-client";
import type { DramaProject, DramaReplicateProfile } from "@/lib/types";
import type { DramaProjectType } from "@/components/drama-production-dock-params";
import type { DramaProductionMode } from "@/components/drama-replicate-dock-params";
import type { DramaTemplateMetadata } from "@/lib/types";
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
import type { DramaPlanStreamEvent } from "@/lib/drama-plan-stream";
import type { DramaProjectPayload } from "@/lib/types";
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
import { DRAMA_SKILL_ID } from "@/lib/drama-submit-routing";
import { shouldUseDramaOrchestration } from "@/lib/drama-submit-routing";
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
  dramaPlanEvents: DramaPlanStreamEvent[];
  dramaPlanPartialProject: DramaProjectPayload | null;
  updateDramaPlanPartialProject: (project: DramaProjectPayload) => void;
  orchestrationPrompt: string;
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
  startDramaPlan: (
    userIdea: string,
    options?: {
      targetDurationSec?: number;
      aspectRatio?: "9:16" | "16:9";
      autoProduce?: boolean;
      projectType?: DramaProjectType;
    },
  ) => Promise<unknown>;
  rerunDramaPlan: (fromAgent: string, projectPatch?: Record<string, unknown>) => Promise<unknown>;
  /** 多轮迭代：基于当前草稿方案按自然语言指令改写，生成新版本 */
  refineDramaPlan: (instruction: string) => Promise<unknown>;
  /** 深拷贝当前方案为新项目（副本），并切换为草稿 */
  duplicateDramaProject: () => Promise<DramaProject | null>;
  resumeDramaPlanRun: (planRunId: string) => void;
  dramaAutoProduce: boolean;
  setDramaAutoProduce: (value: boolean) => void;
  dramaTargetDurationSec: number;
  setDramaTargetDurationSec: (value: number) => void;
  dramaAspectRatio: "9:16" | "16:9";
  setDramaAspectRatio: (value: "9:16" | "16:9") => void;
  dramaProduceHint: string | null;
  dramaProductionMode: DramaProductionMode;
  setDramaProductionMode: (mode: DramaProductionMode) => void;
  dramaProjectType: DramaProjectType;
  setDramaProjectType: (type: DramaProjectType) => void;
  dramaReplicateVideoUrl: string;
  setDramaReplicateVideoUrl: (url: string) => void;
  dramaReplicateProfile: DramaReplicateProfile | null;
  dramaReplicateAnalyzing: boolean;
  analyzeDramaReplicateVideo: () => Promise<void>;
  retryDramaProduction: (fromStep?: string) => Promise<DramaRun | null>;
  rerunDramaFromNode: (
    nodeId: string,
    projectPatch?: Record<string, unknown>,
  ) => Promise<DramaRun | null>;
  cancelOrchestration: () => Promise<void>;
  dispatchSubmit: (ctx: StudioOrchestrationSubmitContext) => Promise<boolean>;
  timelineEvent: OrchestrationTimelineEvent | null;
  timelineActions: OrchestrationTimelineActions | null;
  orchestrationResetTick: number;
  creationLane: CreationLane;
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
  initialDramaTemplate?: DramaTemplateMetadata | null;
  onApplyDramaTemplate?: (template: DramaTemplateMetadata) => void;
  onJobStarted?: (jobId: string) => void;
  onRunSettled?: () => void;
  onClearPrompt?: () => void;
  children: ReactNode;
}

export function StudioOrchestrationProvider({
  sessionId,
  mode,
  readOnly,
  initialDramaTemplate,
  onApplyDramaTemplate,
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
  const [dramaProductionMode, setDramaProductionMode] =
    useState<DramaProductionMode>("original");
  const [dramaProjectType, setDramaProjectType] =
    useState<DramaProjectType>("short_drama");
  const [dramaReplicateVideoUrl, setDramaReplicateVideoUrl] = useState("");
  const [dramaReplicateProfile, setDramaReplicateProfile] =
    useState<DramaReplicateProfile | null>(null);
  const [dramaReplicateAnalyzing, setDramaReplicateAnalyzing] = useState(false);

  const analyzeDramaReplicateVideo = useCallback(async () => {
    const url = dramaReplicateVideoUrl.trim();
    if (!url) return;
    setDramaReplicateAnalyzing(true);
    try {
      const profile = await analyzeDramaReplicate(url);
      setDramaReplicateProfile(profile);
      if (profile.suggestedDurationSec) {
        setDramaTargetDurationSec(profile.suggestedDurationSec);
      }
    } finally {
      setDramaReplicateAnalyzing(false);
    }
  }, [dramaReplicateVideoUrl]);

  const handleDramaProjectTypeChange = useCallback((type: DramaProjectType) => {
    setDramaProjectType(type);
    if (type === "mv") {
      setDramaTargetDurationSec(60);
    }
  }, []);

  const dramaTemplateAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialDramaTemplate || mode !== "production") return;
    const key = JSON.stringify(initialDramaTemplate);
    if (dramaTemplateAppliedRef.current === key) return;
    dramaTemplateAppliedRef.current = key;
    const tpl = initialDramaTemplate;
    setDramaProjectType(tpl.projectType ?? "short_drama");
    if (tpl.targetDurationSec) {
      setDramaTargetDurationSec(tpl.targetDurationSec);
    } else if (tpl.projectType === "mv") {
      setDramaTargetDurationSec(60);
    }
    if (tpl.aspectRatio) {
      setDramaAspectRatio(tpl.aspectRatio);
    }
    setInput((prev) => ({ ...prev, prompt: tpl.userIdea }));
    onApplyDramaTemplate?.(tpl);
  }, [initialDramaTemplate, mode, onApplyDramaTemplate]);

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
    rerunFromNode: rerunDramaFromNodeAction,
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
    partialProject: dramaPlanPartialProject,
    busy: dramaPlanBusy,
    startPlan: startDramaPlan,
    rerunPlan: rerunDramaPlan,
    refinePlan: refineDramaPlanAction,
    cancelWatch: cancelDramaPlanWatch,
    resetPlan: resetDramaPlan,
    restorePlan: restoreDramaPlan,
    resumePlanRun: resumeDramaPlanRun,
    updatePartialProject: updateDramaPlanPartialProject,
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
      activeSkillId: null,
      effectiveMode: mode,
      focusEditActive: false,
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
        if (state.dramaRun.status === "failed" && state.dramaRun.error) {
          setDramaProduceHint(state.dramaRun.error);
        } else if (state.dramaRun.status === "waiting_confirm") {
          setDramaProduceHint(null);
        }
      }

      if (state.draftProject) {
        setDramaDraftProject(state.draftProject);
      }

      if (state.planRun) {
        restoreDramaPlan(state.planRun);
        if (state.planRun.userIdea) {
          setInput((prev) => ({
            ...prev,
            prompt: state.planRun!.userIdea,
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
      !prompt.trim() ||
      shouldUseDramaOrchestration({
        creationLane,
        activeSkillId,
        prompt,
        effectiveMode,
        hasDramaSessionState: Boolean(
          dramaRun || dramaDraftProject || dramaPlanRun,
        ),
      })
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
  }, [input, agentRun, dramaRun, dramaDraftProject, dramaPlanRun]);

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
        partialProject:
          dramaPlanPartialProject ?? dramaDraftProject?.project ?? null,
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
        partialProject:
          dramaPlanPartialProject ?? dramaDraftProject?.project ?? null,
      });
    }
    return null;
  }, [
    dramaPlanRun,
    dramaPlanEvents,
    dramaPlanPartialProject,
    dramaDraftProject?.project,
    input.prompt,
  ]);

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

  const refineDramaPlan = useCallback(
    async (instruction: string) => {
      const projectId = dramaDraftProject?.id ?? dramaPlanRun?.projectId;
      if (!projectId) return null;
      return refineDramaPlanAction(projectId, instruction);
    },
    [dramaDraftProject?.id, dramaPlanRun?.projectId, refineDramaPlanAction],
  );

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

      const hasDramaSessionState = Boolean(
        dramaRun || dramaDraftProject || dramaPlanRun,
      );
      const useDramaSubmit = shouldUseDramaOrchestration({
        creationLane,
        activeSkillId,
        prompt,
        effectiveMode,
        hasDramaSessionState,
      });

      if (
        !shouldOrchestrationHandleSubmit({
          creationLane,
          activeSkillId,
          focusEditActive,
          mentionedMasksCount,
          submitVideo,
          hasReferenceImages,
          dramaSkillActive: useDramaSubmit,
        })
      ) {
        return false;
      }

      const useSkillSubmit = Boolean(activeSkillId) && !useDramaSubmit;
      const useAgentSubmit =
        creationLane === "agent" && !activeSkillId && !useDramaSubmit;

      if (useDramaSubmit) {
        // 多轮迭代：已有完成的草稿方案 + 用户输入新指令 → 改写既有方案（生成新版本），
        // 而非新建规划或直接制作旧草稿。
        const refineInstruction = prompt.trim();
        if (
          dramaDraftProject?.id &&
          dramaPlanRun?.status === "completed" &&
          !dramaRun &&
          refineInstruction.length >= 4
        ) {
          if (dramaProductionMode === "replicate" && !dramaReplicateProfile) {
            alert("请先粘贴参考视频链接并点击「分析结构」");
            return true;
          }
          await ensureSession(sessionId, effectiveMode);
          await refineDramaPlan(refineInstruction);
          void trackEvent("drama_plan_refine", { sessionId });
          return true;
        }

        await submitDramaOrchestration({
          prompt,
          dramaRun,
          planRunState: dramaPlanRun,
          hasDraft: Boolean(dramaDraftProject),
          ensureSession: () => ensureSession(sessionId, effectiveMode),
          confirmRun: confirmOrchestration,
          planRun: (idea) => {
            if (dramaProductionMode === "replicate" && !dramaReplicateProfile) {
              alert("请先粘贴参考视频链接并点击「分析结构」");
              return Promise.resolve();
            }
            return startDramaPlan(idea, {
              targetDurationSec: dramaTargetDurationSec,
              aspectRatio: dramaAspectRatio,
              autoProduce: dramaAutoProduce,
              projectType: dramaProjectType,
              replicateProfile:
                dramaProductionMode === "replicate"
                  ? dramaReplicateProfile ?? undefined
                  : undefined,
            }).then(() => undefined);
          },
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
      dramaProductionMode,
      dramaReplicateProfile,
      dramaProjectType,
      refineDramaPlan,
    ],
  );

  const retryDramaProduction = useCallback(
    async (fromStep?: string) => {
      setDramaProduceHint(null);
      return retryDramaProductionAction(fromStep);
    },
    [retryDramaProductionAction],
  );

  const rerunDramaFromNode = useCallback(
    async (nodeId: string, projectPatch?: Record<string, unknown>) => {
      setDramaProduceHint(null);
      return rerunDramaFromNodeAction(nodeId, projectPatch);
    },
    [rerunDramaFromNodeAction],
  );

  const handleRerunFromAgent = useCallback(
    (fromAgent: string) => {
      void rerunDramaPlan(fromAgent);
    },
    [rerunDramaPlan],
  );

  const duplicateDramaProject = useCallback(async () => {
    const projectId = dramaDraftProject?.id ?? dramaRun?.projectId ?? null;
    if (!projectId) return null;
    const copy = await duplicateDramaProjectApi(projectId);
    setDramaDraftProject(copy);
    setDramaRun(null);
    resetDramaPlan();
    setInput((prev) => ({
      ...prev,
      prompt: "",
      creationLane: "agent",
    }));
    void trackEvent("drama_project_duplicate", { sessionId, projectId });
    return copy;
  }, [
    dramaDraftProject?.id,
    dramaRun?.projectId,
    sessionId,
    setDramaDraftProject,
    setDramaRun,
    resetDramaPlan,
  ]);

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
      dramaPlanEvents,
      dramaPlanPartialProject,
      updateDramaPlanPartialProject,
      orchestrationPrompt: input.prompt,
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
      startDramaPlan,
      rerunDramaPlan,
      refineDramaPlan,
      duplicateDramaProject,
      resumeDramaPlanRun,
      dramaAutoProduce,
      setDramaAutoProduce,
      dramaTargetDurationSec,
      setDramaTargetDurationSec,
      dramaAspectRatio,
      setDramaAspectRatio,
      dramaProduceHint,
      dramaProductionMode,
      setDramaProductionMode,
      dramaProjectType,
      setDramaProjectType: handleDramaProjectTypeChange,
      dramaReplicateVideoUrl,
      setDramaReplicateVideoUrl,
      dramaReplicateProfile,
      dramaReplicateAnalyzing,
      analyzeDramaReplicateVideo,
      retryDramaProduction,
      rerunDramaFromNode,
      cancelOrchestration,
      dispatchSubmit,
      orchestrationResetTick,
      creationLane: input.creationLane,
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
      dramaPlanEvents,
      dramaPlanPartialProject,
      updateDramaPlanPartialProject,
      input.prompt,
      input.creationLane,
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
      startDramaPlan,
      rerunDramaPlan,
      refineDramaPlan,
      duplicateDramaProject,
      resumeDramaPlanRun,
      dramaAutoProduce,
      setDramaAutoProduce,
      dramaTargetDurationSec,
      setDramaTargetDurationSec,
      dramaAspectRatio,
      setDramaAspectRatio,
      dramaProduceHint,
      dramaProductionMode,
      setDramaProductionMode,
      dramaProjectType,
      handleDramaProjectTypeChange,
      dramaReplicateVideoUrl,
      setDramaReplicateVideoUrl,
      dramaReplicateProfile,
      dramaReplicateAnalyzing,
      analyzeDramaReplicateVideo,
      retryDramaProduction,
      rerunDramaFromNode,
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
