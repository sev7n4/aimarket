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
  alternateCanvasContent?: ReactNode;
};

/** Infinite 画布底部编排 Dock（P3-6 统一三路径） */
export function InfiniteOrchestrationDock({
  infiniteOrchestrationDock,
  legacyInfiniteOrchestrationDock,
  alternateCanvasContent,
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
      data-testid="drama-canvas-overlay"
    >
      {alternateCanvasContent}
      {legacyInfiniteOrchestrationDock ? (
        <ScrollOrchestrationSections
          alternateCanvasContent={alternateCanvasContent}
          orchestrationEvent={orchestrationEvent}
          orchestrationActions={orchestrationActions}
          orchestrationExtra={orchestrationExtra}
        />
      ) : null}
    </div>
  );
}

/** Scroll 模式替换主区 + 底部 extra */
export function ScrollAlternateOrchestrationPane({
  alternateCanvasContent,
  orchestrationExtra,
  scrollBottomInset,
}: {
  alternateCanvasContent: ReactNode;
  orchestrationExtra?: ReactNode;
  scrollBottomInset: string;
}) {
  return (
    <div
      className="absolute inset-0 flex min-h-0 flex-col overflow-hidden"
      style={{ paddingBottom: scrollBottomInset }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
        {alternateCanvasContent}
      </div>
      {orchestrationExtra ? (
        <div
          className="shrink-0 border-t border-white/5 p-2 sm:p-3"
          data-testid="orchestration-extra-section"
        >
          {orchestrationExtra}
        </div>
      ) : null}
    </div>
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

function ScrollOrchestrationSections({
  alternateCanvasContent,
  orchestrationEvent,
  orchestrationActions,
  orchestrationExtra,
}: OrchestrationOverlayProps) {
  return (
    <>
      {orchestrationEvent ? (
        <section
          data-testid="orchestration-timeline-section"
          className={alternateCanvasContent ? "mt-3" : undefined}
        >
          <ScrollCanvasOrchestrationCard
            event={orchestrationEvent}
            actions={orchestrationActions}
          />
        </section>
      ) : null}
      {orchestrationExtra ? (
        <div
          data-testid="orchestration-extra-section"
          className={
            alternateCanvasContent || orchestrationEvent ? "mt-3" : undefined
          }
        >
          {orchestrationExtra}
        </div>
      ) : null}
    </>
  );
}
