"use client";

import { ScrollCanvasOrchestrationCard } from "@/components/scroll-canvas-orchestration-card";
import type {
  OrchestrationTimelineActions,
  OrchestrationTimelineEvent,
} from "@/lib/canvas-timeline";

interface ConversationSectionsProps {
  orchestrationEvent?: OrchestrationTimelineEvent | null;
  orchestrationActions?: OrchestrationTimelineActions;
  orchestrationExtra?: React.ReactNode;
}

/**
 * 对话/编排时间线区块（agent 车道）。
 *
 * 抽离自原 scroll-canvas，供两处复用：
 * - 单列画布：作为 ProductGallery 的 footerSlot 注入同一时间线竖轴。
 * - 双栏外壳：作为左栏 ConversationTimeline 的内容。
 */
export function ConversationSections({
  orchestrationEvent = null,
  orchestrationActions,
  orchestrationExtra,
}: ConversationSectionsProps) {
  return (
    <>
      {orchestrationEvent ? (
        <section
          role="listitem"
          data-testid="orchestration-timeline-section"
          className="relative flex gap-3 sm:gap-3.5 pb-2"
        >
          <div className="relative z-[1] flex w-3 shrink-0 flex-col items-center pt-1">
            <span
              className="size-2.5 shrink-0 rounded-full bg-orange-400/90 shadow-[0_0_0_3px_rgba(9,9,11,0.95)] ring-2 ring-orange-500/50"
              aria-hidden
            />
          </div>
          <div className="min-w-0 flex-1">
            <ScrollCanvasOrchestrationCard
              event={orchestrationEvent}
              actions={orchestrationActions}
            />
          </div>
        </section>
      ) : null}

      {orchestrationExtra ? (
        <section
          role="listitem"
          data-testid="orchestration-extra-section"
          className="relative pb-2"
        >
          <div className="min-w-0 flex-1">{orchestrationExtra}</div>
        </section>
      ) : null}
    </>
  );
}

interface ConversationTimelineProps extends ConversationSectionsProps {
  /** 底部避让全局 Dock 的内边距类 */
  scrollBottomInset?: string;
  /** 左栏空态提示 */
  emptyHint?: string;
}

/**
 * 双栏外壳左栏：可独立滚动的对话时间线容器（仅 agent 车道使用）。
 */
export function ConversationTimeline({
  orchestrationEvent = null,
  orchestrationActions,
  orchestrationExtra,
  scrollBottomInset = "",
  emptyHint = "对话与编排记录会显示在这里",
}: ConversationTimelineProps) {
  const hasContent = Boolean(orchestrationEvent) || Boolean(orchestrationExtra);

  return (
    <div
      className="relative flex min-h-0 w-full flex-col overflow-y-auto overflow-x-hidden border-r border-white/5 lg:w-[340px] lg:shrink-0 xl:w-[380px]"
      data-testid="conversation-pane"
    >
      {hasContent ? (
        <div
          className={`w-full py-3 pl-2 pr-3 sm:py-4 sm:pl-3 sm:pr-4 ${scrollBottomInset}`.trim()}
        >
          <div className="relative max-w-5xl" role="list">
            <div
              className="pointer-events-none absolute bottom-2 left-[0.1875rem] top-2 w-px bg-gradient-to-b from-zinc-600/80 via-zinc-700/50 to-transparent"
              aria-hidden
            />
            <ConversationSections
              orchestrationEvent={orchestrationEvent}
              orchestrationActions={orchestrationActions}
              orchestrationExtra={orchestrationExtra}
            />
          </div>
        </div>
      ) : (
        <div
          className={`flex min-h-full w-full items-center justify-center px-4 text-center text-xs text-zinc-600 ${scrollBottomInset}`.trim()}
        >
          {emptyHint}
        </div>
      )}
    </div>
  );
}
