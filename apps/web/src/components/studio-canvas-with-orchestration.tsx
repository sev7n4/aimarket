"use client";

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import {
  DesignCanvas,
  type DesignCanvasHandle,
} from "@/components/design-canvas";
import { DramaFinalVideoPanel } from "@/components/drama-final-video-panel";
import { DramaProductionTimeline } from "@/components/drama-production-timeline";
import { DramaShotTimeline } from "@/components/drama-shot-timeline";
import { DramaTimelineEditor } from "@/components/drama-timeline-editor";
import { DramaAgentPlanWorkspace } from "@/components/drama-agent-plan-workspace";
import { DramaStudioPanel } from "@/components/drama-studio-panel";
import { useStudioOrchestration } from "@/components/studio-orchestration-provider";
import { updateDramaProjectApi } from "@/lib/api-client";
import type { DramaNodeRerunPatch } from "@/components/drama-node-graph";
import { retryDramaShot, pickDramaKeyframe, publishCanvasToInspiration, unpublishInspiration } from "@/lib/api-client";
import { buildDramaPublishPayload } from "@/lib/drama-publish";
import type { DramaProjectPayload } from "@/lib/types";
import { dramaPlanToCanvasNodes, applyDramaNodePositions } from "@/components/infinite-canvas/drama/drama-plan-to-nodes";
import { applyTemplateLayoutToCanvas } from "@/components/infinite-canvas/template-node-layout";
import type { AgentExternalAction, CanvasAgentSnapshot } from "@/components/infinite-canvas/utils";
import type { CanvasAgentOp } from "@/components/infinite-canvas/utils";
import { applyDramaCanvasOps } from "@/components/infinite-canvas/drama/drama-canvas-mutations";
import { dramaShotIdFromNodeId } from "@/lib/infinite-node-tool-run";
import type { DesignCanvasNodeActions } from "@/lib/canvas-node-handlers";
import { useStudioToolHandlersContextOptional } from "@/components/studio-tool-handlers-provider";
import type { CanvasNodeData } from "@/components/infinite-canvas/types";
import type { DramaStudioViewPhase } from "@/lib/drama-studio-view";
import { isCanvasFlowMode } from "@/lib/modes";
import {
  resolveCanvasViewToggleEnabled,
  resolveDramaPhaseSplitEnabled,
  resolveUseInfiniteCanvas,
} from "@/lib/studio-canvas-view";

type StudioCanvasProps = Omit<
  ComponentProps<typeof DesignCanvas>,
  "orchestrationEvent" | "orchestrationActions" | "orchestrationExtra" | "alternateCanvasContent"
> & {
  onInfiniteCanvasActiveChange?: (active: boolean) => void;
};

/** Studio 画布：编排状态来自 Provider，与 Dock 输入解耦 */
export const StudioCanvasWithOrchestration = forwardRef<
  DesignCanvasHandle,
  StudioCanvasProps
>(function StudioCanvasWithOrchestration(props, ref) {
  const {
    timelineEvent,
    timelineActions,
    sessionId,
    studioMode,
    dramaRun,
    dramaRunGraph,
    dramaDraftProject,
    dramaPlanRun,
    dramaPlanEvents,
    dramaPlanPartialProject,
    updateDramaPlanPartialProject,
    orchestrationPrompt,
    dramaBusy,
    saveDramaDraft,
    confirmOrchestration,
    produceDramaDraft,
    startDramaPlan,
    rerunDramaPlan,
    dramaPlanBusy,
    setDramaRun,
    dramaProduceHint,
    retryDramaProduction,
    rerunDramaFromNode,
    dramaAspectRatio,
    dramaTargetDurationSec,
    dramaProjectType,
    resumeDramaPlanRun,
    duplicateDramaProject,
    refineDramaPlan,
    creationLane,
  } = useStudioOrchestration();
  const toolCtx = useStudioToolHandlersContextOptional();

  /** 短剧 UI / 编排仅在 Agent 车道展示；图片 / 视频车道走各自画布逻辑 */
  const dramaLaneActive = creationLane === "agent";

  const templatePlanRunIdRef = useRef<string | null>(null);
  const [pendingTemplateLayout, setPendingTemplateLayout] = useState<
    Record<string, unknown> | null
  >(null);

  useEffect(() => {
    if (
      dramaPlanRun?.id &&
      templatePlanRunIdRef.current &&
      dramaPlanRun.id !== templatePlanRunIdRef.current
    ) {
      setPendingTemplateLayout(null);
      templatePlanRunIdRef.current = null;
    }
  }, [dramaPlanRun?.id]);

  const handleTemplatePlanRunStarted = useCallback(
    (planRunId: string, template: Record<string, unknown>) => {
      templatePlanRunIdRef.current = planRunId;
      setPendingTemplateLayout(template);
      resumeDramaPlanRun(planRunId);
    },
    [resumeDramaPlanRun],
  );

  const isDramaPlanning = dramaPlanRun?.status === "planning";
  const [publishedInspirationId, setPublishedInspirationId] = useState<
    string | null
  >(null);

  const showFinalVideo =
    dramaLaneActive &&
    studioMode === "production" &&
    dramaRun?.status === "completed" &&
    Boolean(dramaRun.finalVideoUrl);
  const showProductionTimeline =
    dramaLaneActive &&
    studioMode === "production" &&
    dramaRun != null &&
    dramaRun.status !== "waiting_confirm" &&
    !showFinalVideo;

  const [timelineProject, setTimelineProject] =
    useState<DramaProjectPayload | null>(null);
  const [storyboardView, setStoryboardView] = useState<"timeline" | "grid">(
    "timeline",
  );
  const [canvasView, setCanvasView] = useState<"storyboard" | "timeline">("storyboard");

  useEffect(() => {
    if (dramaDraftProject?.project) {
      setTimelineProject(dramaDraftProject.project);
    } else {
      setTimelineProject(null);
    }
  }, [dramaDraftProject?.id, dramaDraftProject?.project]);

  // Phase 5.1 + 阶段分离：默认 ScrollCanvas（Agent 车道）；仅用户手动点「节点视图」才进 InfiniteCanvas。
  // E2E 可通过 localStorage["aimarket_canvas_flow"]="0" 或 ?canvasFlow=0 全程 ScrollCanvas。
  const [canvasFlowEnabled, setCanvasFlowEnabled] = useState(true);
  useEffect(() => {
    setCanvasFlowEnabled(isCanvasFlowMode());
  }, []);

  /** 「节点视图 ↔ 滚动视图」切换开关：三车道一致，随 canvasFlow 开放 */
  const canvasViewToggleEnabled = resolveCanvasViewToggleEnabled({
    canvasFlowEnabled,
  });

  /** Infinite 下是否叠加短剧节点面板：仅 Agent 车道 + 制片模式 */
  const dramaPhaseSplitEnabled = resolveDramaPhaseSplitEnabled({
    creationLane,
    studioMode,
    canvasFlowEnabled,
  });

  const derivedViewPhase: DramaStudioViewPhase = "agent";

  /** 用户手动切换节点/对话视图；新一轮规划开始后清除，回到对话视图 */
  const [manualViewPhase, setManualViewPhase] =
    useState<DramaStudioViewPhase | null>(null);
  useEffect(() => {
    if (isDramaPlanning) setManualViewPhase(null);
  }, [isDramaPlanning, dramaPlanRun?.id]);

  /** E2E / 深链：?dramaView=workflow|agent 强制画布阶段（不替代用户手动切换） */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const forced = new URLSearchParams(window.location.search).get("dramaView");
    if (forced === "workflow" || forced === "agent") {
      setManualViewPhase(forced);
    }
  }, [sessionId]);

  const viewPhase = manualViewPhase ?? derivedViewPhase;

  const isDramaPlanActive =
    dramaLaneActive &&
    (dramaPlanRun?.status === "planning" ||
      (dramaPlanRun?.status === "completed" &&
        !dramaRun &&
        Boolean(dramaDraftProject ?? dramaPlanPartialProject)));

  const useInfiniteCanvas = resolveUseInfiniteCanvas({
    canvasFlowEnabled,
    viewPhase,
    isDramaPlanActive,
  });

  const showAgentPlanWorkspace =
    dramaLaneActive &&
    isDramaPlanActive &&
    !showFinalVideo &&
    !showProductionTimeline &&
    !(studioMode === "production" && dramaPhaseSplitEnabled && viewPhase === "workflow");

  const planWorkspaceProject =
    dramaPlanPartialProject ?? dramaDraftProject?.project ?? null;

  const planWorkspaceStatus: "planning" | "completed" | "failed" =
    dramaPlanRun?.status === "failed"
      ? "failed"
      : isDramaPlanning
        ? "planning"
        : "completed";

  const showShotTimeline =
    dramaLaneActive &&
    studioMode === "production" &&
    Boolean(dramaDraftProject?.project.shots.length) &&
    !isDramaPlanning &&
    !showProductionTimeline &&
    !showFinalVideo &&
    !showAgentPlanWorkspace;

  useEffect(() => {
    if (showShotTimeline) {
      setStoryboardView("timeline");
    }
  }, [showShotTimeline, dramaDraftProject?.id]);

  // Compute Drama canvas nodes from the planning result
  const dramaCanvasData = useMemo(() => {
    if (!dramaLaneActive || showAgentPlanWorkspace) return { nodes: [], connections: [] };
    const payload = dramaDraftProject?.project ?? dramaRun?.project;
    if (!payload) return { nodes: [], connections: [] };
    const base = dramaPlanToCanvasNodes(payload);
    const withTemplate = applyTemplateLayoutToCanvas(base, pendingTemplateLayout);
    return applyDramaNodePositions(withTemplate, props.dramaNodePositions);
  }, [
    dramaDraftProject?.project,
    dramaRun?.project,
    pendingTemplateLayout,
    props.dramaNodePositions,
    dramaLaneActive,
    showAgentPlanWorkspace,
  ]);

  // Assistant snapshot metadata（节点/连线由 design-canvas effectiveAssistantSnapshot 实时合并）
  const assistantSnapshot = useMemo<CanvasAgentSnapshot | null>(() => {
    if (showAgentPlanWorkspace) return null;
    const payload = dramaDraftProject?.project ?? dramaRun?.project;
    if (!payload && dramaCanvasData.nodes.length === 0) return null;
    return {
      projectId: dramaDraftProject?.id ?? dramaRun?.id ?? "",
      title: payload?.script?.title ?? "AIMarket Drama",
      nodes: dramaCanvasData.nodes,
      connections: dramaCanvasData.connections,
      selectedNodeIds: [],
      viewport: { x: 16, y: 16, k: 1 },
    };
  }, [
    dramaDraftProject?.id,
    dramaRun?.id,
    dramaDraftProject?.project,
    dramaRun?.project,
    dramaCanvasData.nodes,
    dramaCanvasData.connections,
    showAgentPlanWorkspace,
  ]);

  const handleRerunFromAgent = useCallback(
    (fromAgent: string) => {
      void rerunDramaPlan(fromAgent);
    },
    [rerunDramaPlan],
  );

  const handleRetryShot = useCallback(
    (shotId: string, stage: "keyframe" | "video") => {
      if (!dramaRun?.id) return;
      void retryDramaShot(dramaRun.id, shotId, stage).then((next) => {
        if (next) setDramaRun(next);
      });
    },
    [dramaRun?.id, setDramaRun],
  );

  const handlePickKeyframe = useCallback(
    (shotId: string, heroIndex: number) => {
      if (!dramaRun?.id) return;
      void pickDramaKeyframe(dramaRun.id, shotId, heroIndex).then((next) => {
        if (next) setDramaRun(next);
      });
    },
    [dramaRun?.id, setDramaRun],
  );

  const handleRetryProduction = useCallback(
    (fromStep?: string) => {
      if (!dramaRun?.id) return;
      void retryDramaProduction(fromStep).then((next) => {
        if (next) setDramaRun(next);
      });
    },
    [dramaRun?.id, retryDramaProduction, setDramaRun],
  );

  const handleConfirmProduce = useCallback(() => {
    if (dramaDraftProject) {
      void produceDramaDraft();
      return;
    }
    void confirmOrchestration();
  }, [dramaDraftProject, produceDramaDraft, confirmOrchestration]);

  const handleTimelineSave = useCallback(
    (project: DramaProjectPayload) => saveDramaDraft(project),
    [saveDramaDraft],
  );

  const planWorkspaceProjectId =
    dramaPlanRun?.projectId ?? dramaDraftProject?.id;

  const handlePlanProjectUpdate = useCallback(
    (project: DramaProjectPayload) => {
      updateDramaPlanPartialProject(project);
    },
    [updateDramaPlanPartialProject],
  );

  const handlePlanProjectSave = useCallback(
    async (project: DramaProjectPayload) => {
      if (!planWorkspaceProjectId) return;
      const saved = await updateDramaProjectApi(planWorkspaceProjectId, project);
      updateDramaPlanPartialProject(saved.project);
      if (dramaDraftProject?.id === planWorkspaceProjectId) {
        await saveDramaDraft(saved.project);
      }
    },
    [
      planWorkspaceProjectId,
      updateDramaPlanPartialProject,
      dramaDraftProject?.id,
      saveDramaDraft,
    ],
  );

  const handlePatchDramaShotNode = useCallback(
    (
      nodeId: string,
      patch: {
        cameraShotSize?: string;
        cameraMovement?: string;
        cameraLighting?: string;
        visualPrompt?: string;
      },
    ) => {
      const shotId = dramaShotIdFromNodeId(nodeId);
      const baseProject = dramaDraftProject?.project ?? dramaRun?.project;
      if (!shotId || !baseProject) return;
      const nextProject: DramaProjectPayload = {
        ...baseProject,
        shots: baseProject.shots.map((shot) =>
          shot.id === shotId
            ? {
                ...shot,
                visualPrompt: patch.visualPrompt ?? shot.visualPrompt,
                cameraSpec: {
                  ...shot.cameraSpec,
                  shotSize: patch.cameraShotSize ?? shot.cameraSpec?.shotSize,
                  movement: patch.cameraMovement ?? shot.cameraSpec?.movement,
                  lighting: patch.cameraLighting ?? shot.cameraSpec?.lighting,
                },
              }
            : shot,
        ),
      };
      void saveDramaDraft(nextProject);
    },
    [dramaDraftProject?.project, dramaRun?.project, saveDramaDraft],
  );

  const handlePublishToInspiration = useCallback(async () => {
    if (!dramaRun) return null;
    const payload = buildDramaPublishPayload(dramaRun);
    const item = await publishCanvasToInspiration(payload);
    setPublishedInspirationId(item.id);
    return item.id;
  }, [dramaRun]);

  const handleUnpublishFromInspiration = useCallback(
    async (inspirationId: string) => {
      await unpublishInspiration(inspirationId);
      setPublishedInspirationId(null);
    },
    [],
  );

  const handleRerunFromNode = useCallback(
    async (nodeId: string, projectPatch: DramaNodeRerunPatch) => {
      await rerunDramaFromNode(nodeId, projectPatch);
    },
    [rerunDramaFromNode],
  );

  const handleAgentExternalAction = useCallback(
    (action: AgentExternalAction) => {
      switch (action.type) {
        case "plan_drama":
          void startDramaPlan(action.idea, {
            aspectRatio:
              (action.aspectRatio as "9:16" | "16:9" | undefined) ??
              dramaAspectRatio,
            targetDurationSec: action.targetDurationSec ?? dramaTargetDurationSec,
            projectType: dramaProjectType,
          });
          break;
        case "run_drama_production":
          void produceDramaDraft();
          break;
        case "generate_character_sheet":
          void rerunDramaFromNode("char_refs", {});
          break;
        case "generate_shot_image": {
          const shotId = action.shotNodeId.replace(/^drama-shot-/, "");
          handleRetryShot(shotId, "keyframe");
          break;
        }
        case "generate_shot_video": {
          const shotId = action.shotNodeId.replace(/^drama-shot-/, "");
          handleRetryShot(shotId, "video");
          break;
        }
        default:
          break;
      }
    },
    [
      startDramaPlan,
      dramaAspectRatio,
      dramaTargetDurationSec,
      dramaProjectType,
      produceDramaDraft,
      rerunDramaFromNode,
      handleRetryShot,
    ],
  );

  const handleDramaCanvasOps = useCallback(
    (ops: CanvasAgentOp[]) => {
      const base = dramaDraftProject?.project ?? dramaRun?.project;
      if (!base) return;
      const next = applyDramaCanvasOps(base, ops);
      void saveDramaDraft(next);
    },
    [dramaDraftProject?.project, dramaRun?.project, saveDramaDraft],
  );

  const panelPresentation: "agent" | "workflow" =
    dramaPhaseSplitEnabled && viewPhase === "workflow" && useInfiniteCanvas
      ? "workflow"
      : "agent";

  const showDramaStudioPanel =
    dramaLaneActive && Boolean(dramaRun || dramaDraftProject) && !showAgentPlanWorkspace;

  const scrollOrchestrationEvent = useMemo(() => {
    const event = timelineEvent;
    if (!dramaLaneActive && event && (event.runType === "drama_plan" || event.runType === "drama_run")) {
      return null;
    }
    if (showAgentPlanWorkspace && event?.runType === "drama_plan") {
      return null;
    }
    return event;
  }, [dramaLaneActive, timelineEvent, showAgentPlanWorkspace]);

  const dramaPanel = showDramaStudioPanel ? (
      <DramaStudioPanel
        sessionId={sessionId}
        draftProject={dramaDraftProject}
        run={dramaRun}
        runGraph={dramaRunGraph}
        planning={false}
        presentation={panelPresentation}
        busy={dramaBusy || dramaPlanBusy}
        shotTimelineOnCanvas={useInfiniteCanvas && showShotTimeline}
        productionTimelineOnCanvas={useInfiniteCanvas && showProductionTimeline}
        finalVideoOnCanvas={showFinalVideo}
        storyboardView={storyboardView}
        onStoryboardViewChange={setStoryboardView}
        onRerunFromAgent={
          dramaDraftProject &&
          (dramaPlanRun?.status === "completed" ||
            dramaPlanRun?.status === "failed")
            ? handleRerunFromAgent
            : undefined
        }
        rerunBusy={dramaPlanBusy}
        onDuplicate={
          dramaDraftProject && !props.readOnly
            ? duplicateDramaProject
            : undefined
        }
        onConfirmProduce={handleConfirmProduce}
        onRetryShot={dramaRun ? handleRetryShot : undefined}
        onPickKeyframe={dramaRun ? handlePickKeyframe : undefined}
        onSaveDraft={dramaDraftProject ? saveDramaDraft : undefined}
        produceHint={dramaProduceHint}
        onRetryProduction={dramaRun?.status === "failed" ? handleRetryProduction : undefined}
        retryBusy={dramaBusy}
        onRerunFromNode={
          dramaRun &&
          (dramaRun.status === "completed" ||
            dramaRun.status === "failed" ||
            dramaRun.status === "cancelled")
            ? handleRerunFromNode
            : undefined
        }
        rerunNodeBusy={dramaBusy}
        onPublishToInspiration={
          showFinalVideo ? handlePublishToInspiration : undefined
        }
        onUnpublishFromInspiration={
          showFinalVideo ? handleUnpublishFromInspiration : undefined
        }
        publishedInspirationId={publishedInspirationId}
      />
    ) : null;

  const showTimelineEditor =
    studioMode === "production" &&
    dramaRun?.status === "completed" &&
    canvasView === "timeline";

  const alternateCanvasContent =
    showTimelineEditor && dramaRun && timelineProject ? (
      <DramaTimelineEditor
        project={timelineProject}
        readOnly={props.readOnly}
        busy={dramaBusy}
        onProjectChange={setTimelineProject}
        onSave={dramaDraftProject ? handleTimelineSave : undefined}
      />
    ) : showFinalVideo && dramaRun ? (
      <DramaFinalVideoPanel
        run={dramaRun}
        busy={dramaBusy}
        publishedInspirationId={publishedInspirationId}
        onPublish={handlePublishToInspiration}
        onUnpublish={handleUnpublishFromInspiration}
      />
    ) : showProductionTimeline && dramaRun && !useInfiniteCanvas ? (
      <DramaProductionTimeline
        run={dramaRun}
        busy={dramaBusy}
        onRetryShot={handleRetryShot}
        onPickKeyframe={handlePickKeyframe}
      />
    ) : showAgentPlanWorkspace &&
      (isDramaPlanning || planWorkspaceProject) ? (
      <DramaAgentPlanWorkspace
        sessionId={sessionId}
        prompt={orchestrationPrompt}
        events={dramaPlanEvents}
        currentAgent={dramaPlanRun?.currentAgent}
        partialProject={planWorkspaceProject}
        projectId={planWorkspaceProjectId}
        readOnly={props.readOnly}
        busy={dramaBusy || dramaPlanBusy}
        status={planWorkspaceStatus}
        error={dramaPlanRun?.error}
        refreshKey={dramaPlanRun?.id ?? dramaDraftProject?.id}
        onProjectUpdate={handlePlanProjectUpdate}
        onSaveProject={handlePlanProjectSave}
        onRefinePlan={
          planWorkspaceProjectId && refineDramaPlan
            ? (instruction) => refineDramaPlan(instruction)
            : undefined
        }
        onRerunFromAgent={
          dramaPlanRun?.status === "completed" ||
          dramaPlanRun?.status === "failed"
            ? handleRerunFromAgent
            : undefined
        }
        rerunBusy={dramaPlanBusy}
        onConfirmProduce={
          planWorkspaceStatus === "completed" ? handleConfirmProduce : undefined
        }
        produceBusy={dramaBusy || dramaPlanBusy}
        produceHint={dramaProduceHint}
      />
    ) : showShotTimeline && timelineProject && !useInfiniteCanvas ? (
      <DramaShotTimeline
        project={timelineProject}
        readOnly={props.readOnly}
        busy={dramaBusy}
        onProjectChange={setTimelineProject}
        onSave={dramaDraftProject ? handleTimelineSave : undefined}
        projectId={dramaDraftProject?.id}
        sessionId={sessionId}
      />
    ) : null;

  const mergedNodeActions = useMemo((): DesignCanvasNodeActions | undefined => {
    const base = props.nodeActions ?? toolCtx?.nodeActions;
    if (!dramaLaneActive) return base;

    const drama: NonNullable<DesignCanvasNodeActions["drama"]> = {
      ...base?.drama,
      onGenerateShotImage: dramaRun
        ? (node: CanvasNodeData) => {
            const shotId = dramaShotIdFromNodeId(node.id);
            if (shotId) handleRetryShot(shotId, "keyframe");
          }
        : base?.drama?.onGenerateShotImage,
      onGenerateShotVideo: dramaRun
        ? (node: CanvasNodeData) => {
            const shotId = dramaShotIdFromNodeId(node.id);
            if (shotId) handleRetryShot(shotId, "video");
          }
        : base?.drama?.onGenerateShotVideo,
      onGenerateCharacterSheet: dramaRun
        ? () => {
            void rerunDramaFromNode("char_refs", {});
          }
        : base?.drama?.onGenerateCharacterSheet,
      onGenerateShotsFromScript:
        dramaDraftProject &&
        (dramaPlanRun?.status === "completed" ||
          dramaPlanRun?.status === "failed")
          ? () => {
              handleRerunFromAgent("storyboard");
            }
          : base?.drama?.onGenerateShotsFromScript,
    };

    return { ...base, drama };
  }, [
    props.nodeActions,
    toolCtx?.nodeActions,
    dramaLaneActive,
    dramaRun,
    dramaDraftProject,
    dramaPlanRun?.status,
    handleRetryShot,
    rerunDramaFromNode,
    handleRerunFromAgent,
  ]);

  return (
    <DesignCanvas
      ref={ref}
      {...toolCtx}
      {...props}
      nodeActions={mergedNodeActions}
      useInfiniteCanvas={useInfiniteCanvas}
      conversationPaneEnabled={dramaLaneActive}
      canvasViewEnabled={canvasViewToggleEnabled}
      dramaPhaseSplitEnabled={dramaPhaseSplitEnabled}
      dramaViewPhase={canvasViewToggleEnabled ? viewPhase : undefined}
      onDramaViewPhaseChange={
        canvasViewToggleEnabled ? setManualViewPhase : undefined
      }
      onInfiniteCanvasActiveChange={props.onInfiniteCanvasActiveChange}
      orchestrationEvent={scrollOrchestrationEvent}
      orchestrationActions={timelineActions ?? undefined}
      alternateCanvasContent={alternateCanvasContent}
      orchestrationExtra={dramaPanel}
      dramaNodes={dramaCanvasData.nodes}
      dramaConnections={dramaCanvasData.connections}
      assistantSnapshot={assistantSnapshot}
      onAgentExternalAction={handleAgentExternalAction}
      onApplyAssistantOps={handleDramaCanvasOps}
      allowDramaNodeCreate={Boolean(dramaDraftProject?.project)}
      onPatchDramaShotNode={handlePatchDramaShotNode}
      onTemplatePlanRunStarted={handleTemplatePlanRunStarted}
      sessionId={sessionId}
    />
  );
});
