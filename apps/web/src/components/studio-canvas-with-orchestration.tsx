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
import { DramaStudioPanel } from "@/components/drama-studio-panel";
import { useStudioOrchestration } from "@/components/studio-orchestration-provider";
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
import { isCanvasFlowMode } from "@/lib/modes";

type StudioCanvasProps = Omit<
  ComponentProps<typeof DesignCanvas>,
  "orchestrationEvent" | "orchestrationActions" | "orchestrationExtra" | "alternateCanvasContent"
>;

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
  } = useStudioOrchestration();

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
    studioMode === "production" &&
    dramaRun?.status === "completed" &&
    Boolean(dramaRun.finalVideoUrl);
  const showProductionTimeline =
    studioMode === "production" &&
    dramaRun != null &&
    dramaRun.status !== "waiting_confirm" &&
    !showFinalVideo;
  const showShotTimeline =
    studioMode === "production" &&
    Boolean(dramaDraftProject?.project.shots.length) &&
    !isDramaPlanning &&
    !showProductionTimeline &&
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

  useEffect(() => {
    if (showShotTimeline) {
      setStoryboardView("timeline");
    }
  }, [showShotTimeline, dramaDraftProject?.id]);

  // Phase 5.1: 生产路径总是使用 InfiniteCanvas。
  // E2E 用例通过 addInitScript 设置 localStorage["aimarket_canvas_flow"] = "0"
  // 或 URL 参数 ?canvasFlow=0 强制回退到 ScrollCanvas 路径。
  const [useInfiniteCanvas, setUseInfiniteCanvas] = useState(true);
  useEffect(() => {
    setUseInfiniteCanvas(isCanvasFlowMode());
  }, []);

  // Compute Drama canvas nodes from the planning result
  const dramaCanvasData = useMemo(() => {
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
  ]);

  // Assistant snapshot metadata（节点/连线由 design-canvas effectiveAssistantSnapshot 实时合并）
  const assistantSnapshot = useMemo<CanvasAgentSnapshot | null>(() => {
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

  const dramaPanel =
    isDramaPlanning || dramaRun || dramaDraftProject ? (
      <DramaStudioPanel
        sessionId={sessionId}
        draftProject={dramaDraftProject}
        run={dramaRun}
        runGraph={dramaRunGraph}
        planning={isDramaPlanning}
        busy={dramaBusy || dramaPlanBusy}
        shotTimelineOnCanvas={!useInfiniteCanvas && showShotTimeline}
        productionTimelineOnCanvas={!useInfiniteCanvas && showProductionTimeline}
        finalVideoOnCanvas={!useInfiniteCanvas && showFinalVideo}
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
    ) : showProductionTimeline && dramaRun ? (
      <DramaProductionTimeline
        run={dramaRun}
        busy={dramaBusy}
        onRetryShot={handleRetryShot}
        onPickKeyframe={handlePickKeyframe}
      />
    ) : showShotTimeline && timelineProject ? (
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

  return (
    <DesignCanvas
      ref={ref}
      {...props}
      useInfiniteCanvas={useInfiniteCanvas}
      orchestrationEvent={timelineEvent}
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
