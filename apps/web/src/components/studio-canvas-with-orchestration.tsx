"use client";

import { forwardRef, useCallback, useEffect, useState, type ComponentProps } from "react";
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
    rerunDramaPlan,
    dramaPlanBusy,
    setDramaRun,
    dramaProduceHint,
    retryDramaProduction,
    rerunDramaFromNode,
  } = useStudioOrchestration();

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

  const dramaPanel =
    isDramaPlanning || dramaRun || dramaDraftProject ? (
      <DramaStudioPanel
        sessionId={sessionId}
        draftProject={dramaDraftProject}
        run={dramaRun}
        runGraph={dramaRunGraph}
        planning={isDramaPlanning}
        busy={dramaBusy || dramaPlanBusy}
        shotTimelineOnCanvas={showShotTimeline}
        productionTimelineOnCanvas={showProductionTimeline}
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
      useInfiniteCanvas
      orchestrationEvent={alternateCanvasContent ? null : timelineEvent}
      orchestrationActions={timelineActions ?? undefined}
      alternateCanvasContent={alternateCanvasContent}
      orchestrationExtra={dramaPanel}
    />
  );
});
