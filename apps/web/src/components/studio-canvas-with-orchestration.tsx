"use client";

import { forwardRef, useCallback, type ComponentProps } from "react";
import {
  DesignCanvas,
  type DesignCanvasHandle,
} from "@/components/design-canvas";
import { DramaStudioPanel } from "@/components/drama-studio-panel";
import { useStudioOrchestration } from "@/components/studio-orchestration-provider";
import { retryDramaShot } from "@/lib/api-client";

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
    dramaRun,
    dramaDraftProject,
    dramaBusy,
    confirmOrchestration,
  } = useStudioOrchestration();

  const handleRetryShot = useCallback(
    (shotId: string, stage: "keyframe" | "video") => {
      if (!dramaRun?.id) return;
      void retryDramaShot(dramaRun.id, shotId, stage);
    },
    [dramaRun?.id],
  );

  const dramaPanel =
    dramaRun || dramaDraftProject ? (
      <DramaStudioPanel
        draftProject={dramaDraftProject}
        run={dramaRun}
        busy={dramaBusy}
        onConfirmProduce={() => void confirmOrchestration()}
        onRetryShot={dramaRun ? handleRetryShot : undefined}
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
