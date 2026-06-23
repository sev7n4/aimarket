"use client";

import { forwardRef, useCallback, type ComponentProps } from "react";
import {
  DesignCanvas,
  type DesignCanvasHandle,
} from "@/components/design-canvas";
import { DramaStudioPanel } from "@/components/drama-studio-panel";
import { useStudioOrchestration } from "@/components/studio-orchestration-provider";
import { retryDramaShot, pickDramaKeyframe } from "@/lib/api-client";

type StudioCanvasProps = Omit<
  ComponentProps<typeof DesignCanvas>,
  "orchestrationEvent" | "orchestrationActions" | "orchestrationExtra"
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

  const dramaPanel =
    isDramaPlanning || dramaRun || dramaDraftProject ? (
      <DramaStudioPanel
        sessionId={sessionId}
        draftProject={dramaDraftProject}
        run={dramaRun}
        planning={isDramaPlanning}
        busy={dramaBusy || dramaPlanBusy}
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

  return (
    <DesignCanvas
      ref={ref}
      {...props}
      orchestrationEvent={timelineEvent}
      orchestrationActions={timelineActions ?? undefined}
      orchestrationExtra={dramaPanel}
    />
  );
});
