"use client";

import { forwardRef, type ComponentProps } from "react";
import {
  DesignCanvas,
  type DesignCanvasHandle,
} from "@/components/design-canvas";
import { useStudioOrchestration } from "@/components/studio-orchestration-provider";

type StudioCanvasProps = Omit<
  ComponentProps<typeof DesignCanvas>,
  "orchestrationEvent" | "orchestrationActions"
>;

/** Studio 画布：编排状态来自 Provider，与 Dock 输入解耦 */
export const StudioCanvasWithOrchestration = forwardRef<
  DesignCanvasHandle,
  StudioCanvasProps
>(function StudioCanvasWithOrchestration(props, ref) {
  const { timelineEvent, timelineActions } = useStudioOrchestration();
  return (
    <DesignCanvas
      ref={ref}
      {...props}
      orchestrationEvent={timelineEvent}
      orchestrationActions={timelineActions ?? undefined}
    />
  );
});
