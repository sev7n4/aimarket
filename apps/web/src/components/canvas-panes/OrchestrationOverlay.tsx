"use client";

import type { ReactNode } from "react";

import {
  ConversationSections,
  ConversationTimeline,
} from "@/components/conversation-timeline";
import { ScrollCanvasOrchestrationCard } from "@/components/scroll-canvas-orchestration-card";
import type {
  OrchestrationTimelineActions,
  OrchestrationTimelineEvent,
} from "@/lib/canvas-timeline";

export type OrchestrationOverlayProps = {
  orchestrationEvent?: OrchestrationTimelineEvent | null;
  orchestrationActions?: OrchestrationTimelineActions;
  orchestrationExtra?: ReactNode;
};

/** Infinite 画布底部编排 Dock（Agent / Skill 时间线） */
export function InfiniteOrchestrationDock({
  infiniteOrchestrationDock,
  legacyInfiniteOrchestrationDock,
  orchestrationEvent,
  orchestrationActions,
  orchestrationExtra,
}: OrchestrationOverlayProps & {
  infiniteOrchestrationDock: boolean;
  legacyInfiniteOrchestrationDock: boolean;
}) {
  if (!infiniteOrchestrationDock && !legacyInfiniteOrchestrationDock) return null;

  return (
    <div
      className="shrink-0 overflow-y-auto border-t border-white/10 p-2 sm:p-3"
      style={{ maxHeight: "42vh" }}
      data-testid="canvas-orchestration-overlay"
    >
      {legacyInfiniteOrchestrationDock ? (
        <ScrollOrchestrationSections
          orchestrationEvent={orchestrationEvent}
          orchestrationActions={orchestrationActions}
          orchestrationExtra={orchestrationExtra}
        />
      ) : null}
    </div>
  );
}

export function ScrollOrchestrationSections({
  orchestrationEvent,
  orchestrationActions,
  orchestrationExtra,
}: OrchestrationOverlayProps) {
  return (
    <>
      {orchestrationEvent ? (
        <section data-testid="orchestration-timeline-section">
          <ScrollCanvasOrchestrationCard
            event={orchestrationEvent}
            actions={orchestrationActions}
          />
        </section>
      ) : null}
      {orchestrationExtra ? (
        <div data-testid="orchestration-extra-section" className="mt-3">
          {orchestrationExtra}
        </div>
      ) : null}
    </>
  );
}

/** ProductGallery footer 编排区 */
export function GalleryOrchestrationFooter(props: OrchestrationOverlayProps) {
  if (!props.orchestrationEvent && !props.orchestrationExtra) return null;
  return <ConversationSections {...props} />;
}

/** 双栏左对话 Timeline */
export function ConversationOrchestrationPane({
  orchestrationEvent,
  orchestrationActions,
  orchestrationExtra,
  scrollBottomInset,
  width,
}: OrchestrationOverlayProps & {
  scrollBottomInset: string;
  width?: number;
}) {
  return (
    <ConversationTimeline
      orchestrationEvent={orchestrationEvent}
      orchestrationActions={orchestrationActions}
      orchestrationExtra={orchestrationExtra}
      scrollBottomInset={scrollBottomInset}
      width={width}
    />
  );
}
