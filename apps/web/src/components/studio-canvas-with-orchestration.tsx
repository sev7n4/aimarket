"use client";

import { forwardRef, useCallback, useEffect, useState, type ComponentProps } from "react";
import {
  DesignCanvas,
  type DesignCanvasHandle,
} from "@/components/design-canvas";
import { DramaProductionTimeline } from "@/components/drama-production-timeline";
import { DramaShotTimeline } from "@/components/drama-shot-timeline";
import { DramaStudioPanel } from "@/components/drama-studio-panel";
import { useStudioOrchestration } from "@/components/studio-orchestration-provider";
import { retryDramaShot, pickDramaKeyframe } from "@/lib/api-client";
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
  } = useStudioOrchestration();

  const isDramaPlanning = dramaPlanRun?.status === "planning";
  const showProductionTimeline =
    studioMode === "production" &&
    dramaRun != null &&
    dramaRun.status !== "waiting_confirm";
  const showShotTimeline =
    studioMode === "production" &&
    Boolean(dramaDraftProject?.project.shots.length) &&
    !isDramaPlanning &&
    !showProductionTimeline;

  const [timelineProject, setTimelineProject] =
    useState<DramaProjectPayload | null>(null);
  const [storyboardView, setStoryboardView] = useState<"timeline" | "grid">(
    "timeline",
  );

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

  const dramaPanel =
    isDramaPlanning || dramaRun || dramaDraftProject ? (
      <DramaStudioPanel
        sessionId={sessionId}
        draftProject={dramaDraftProject}
        run={dramaRun}
        planning={isDramaPlanning}
        busy={dramaBusy || dramaPlanBusy}
        shotTimelineOnCanvas={showShotTimeline}
        productionTimelineOnCanvas={showProductionTimeline}
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
      />
    ) : null;

  const alternateCanvasContent =
    showProductionTimeline && dramaRun ? (
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
      />
    ) : null;

  return (
    <DesignCanvas
      ref={ref}
      {...props}
      orchestrationEvent={alternateCanvasContent ? null : timelineEvent}
      orchestrationActions={timelineActions ?? undefined}
      alternateCanvasContent={alternateCanvasContent}
      orchestrationExtra={dramaPanel}
    />
  );
});
