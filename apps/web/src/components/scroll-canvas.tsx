"use client";

import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { assetUrl } from "@/lib/api-client";
import type { CanvasItem, BatchSection } from "@/lib/canvas-tools";
import { batchDisplayIndex } from "@/lib/canvas-tools";
import { CanvasJobOverlay } from "@/components/canvas-job-overlay";
import { ScrollCanvasItemChrome } from "@/components/scroll-canvas-item-chrome";
import { RefineSelectedCta } from "@/components/refine-selected-cta";
import { ScrollCanvasOrchestrationCard } from "@/components/scroll-canvas-orchestration-card";
import type {
  OrchestrationTimelineActions,
  OrchestrationTimelineEvent,
} from "@/lib/canvas-timeline";
import type { StudioTool } from "@/lib/types";
import { hapticLight } from "@/lib/haptics";

export interface ScrollCanvasHandle {
  scrollToBatch: (batchId: string) => void;
}

function timelineTimeLabel(section: BatchSection): string {
  const fromSubtitle = section.subtitle?.split(" · ")[0]?.trim();
  if (fromSubtitle) return fromSubtitle;
  if (section.index >= 0) return `批次 ${section.index + 1}`;
  return section.title;
}

function timelineMetaLabel(section: BatchSection): string | null {
  if (section.index >= 0) return `批次 ${section.index + 1}`;
  return null;
}

interface ScrollCanvasProps {
  items: CanvasItem[];
  batchSections: BatchSection[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  readOnly: boolean;
  emptyHint: string;
  pulseId: string | null;
  onEnterRefineMode: (itemId: string) => void;
  onSetLightbox: (lb: { items: CanvasItem[]; index: number } | null) => void;
  onDeleteSelected: () => void;
  onRerun: (item: CanvasItem) => void;
  onDownloadItem?: (item: CanvasItem) => void;
  onShareItem?: (item: CanvasItem) => void;
  onJumpToParentBatch?: (
    parentBatchId: string,
    sourceItemId?: string,
  ) => void;
  jobStreamStatus?: string | null;
  jobFailed?: boolean;
  jobProgressCompleted?: number;
  jobProgressTotal?: number;
  onOpenChatPanel?: () => void;
  onCancelJob?: () => void;
  jobElapsedMs?: number;
  queueAhead?: number | null;
  focusClickActive: boolean;
  focusItem: CanvasItem | null;
  onFocusImageClick?: (
    item: CanvasItem,
    point: { x: number; y: number },
  ) => void;
  scrollBottomInset?: string;
  /** Agent / Skill 编排卡片（对标 Cursor 主区时间线） */
  orchestrationEvent?: OrchestrationTimelineEvent | null;
  orchestrationActions?: OrchestrationTimelineActions;
  batchTools?: {
    tools: StudioTool[];
    pendingToolId?: string | null;
    onRunTool: (tool: StudioTool, item: CanvasItem) => void;
    onMentionItem?: (item: CanvasItem) => void;
  };
}

export const ScrollCanvas = forwardRef<ScrollCanvasHandle, ScrollCanvasProps>(
  function ScrollCanvas(
    {
      items,
      batchSections,
      selectedId,
      onSelect,
      readOnly,
      emptyHint,
      pulseId,
      onEnterRefineMode,
      onSetLightbox,
      onDeleteSelected,
      onRerun,
      onDownloadItem,
      onShareItem,
      onJumpToParentBatch,
      jobStreamStatus,
      jobFailed,
      jobProgressCompleted,
      jobProgressTotal,
      onOpenChatPanel,
      onCancelJob,
      jobElapsedMs,
      queueAhead,
      focusClickActive,
      focusItem,
      onFocusImageClick,
      scrollBottomInset = "",
      orchestrationEvent = null,
      orchestrationActions,
      batchTools,
    },
    ref,
  ) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const showJobOverlay =
      Boolean(jobStreamStatus) &&
      jobStreamStatus !== "succeeded" &&
      jobStreamStatus !== "failed";

    const scrollToBatch = useCallback((batchId: string) => {
      const el = scrollContainerRef.current;
      if (!el) return;
      const section = el.querySelector(
        `[data-testid="canvas-batch-section-${batchId}"]`,
      );
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, []);

    useImperativeHandle(ref, () => ({ scrollToBatch }), [scrollToBatch]);

    return (
      <div
        ref={scrollContainerRef}
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
        onClick={() => onSelect(null)}
      >
        {showJobOverlay || jobFailed ? (
          <CanvasJobOverlay
            status={jobStreamStatus ?? null}
            failed={jobFailed}
            onOpenChat={onOpenChatPanel}
            onCancel={onCancelJob}
            completed={jobProgressCompleted}
            total={jobProgressTotal}
            elapsedMs={jobElapsedMs}
            queueAhead={queueAhead}
          />
        ) : null}

        {items.length === 0 && !orchestrationEvent ? (
          <div
            className={`min-h-full w-full ${scrollBottomInset}`.trim()}
            aria-label="画布"
          />
        ) : (
          <div
            className={`w-full py-3 pl-2 pr-3 sm:py-4 sm:pl-3 sm:pr-4 ${scrollBottomInset}`.trim()}
          >
            <div
              className="relative max-w-5xl"
              data-testid="scroll-canvas-timeline"
              role="list"
            >
              <div
                className="pointer-events-none absolute left-[0.1875rem] top-2 bottom-2 w-px bg-gradient-to-b from-zinc-600/80 via-zinc-700/50 to-transparent"
                aria-hidden
              />

              {batchSections.map((section, sectionIdx) => {
                const batchItems = items.filter(
                  (i) => i.batchId === section.id,
                );
                const parentNum = section.parentBatchId
                  ? batchDisplayIndex(items, section.parentBatchId)
                  : null;
                const isLast =
                  sectionIdx === batchSections.length - 1 && !orchestrationEvent;
                const batchLabel = timelineMetaLabel(section);
                const timeLabel = timelineTimeLabel(section);

                return (
                  <section
                    key={section.id}
                    role="listitem"
                    data-testid={`canvas-batch-section-${section.id}`}
                    className={`relative flex gap-3 sm:gap-3.5 ${isLast ? "pb-2" : "pb-10"}`}
                  >
                    <div className="relative z-[1] flex w-3 shrink-0 flex-col items-center pt-1">
                      <span
                        className="size-2.5 shrink-0 rounded-full bg-zinc-100 shadow-[0_0_0_3px_rgba(9,9,11,0.95)] ring-2 ring-zinc-500/80"
                        aria-hidden
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <header className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <time
                          className="text-[13px] font-medium tabular-nums text-zinc-300"
                          dateTime={timeLabel}
                        >
                          {timeLabel}
                        </time>
                        {batchLabel ? (
                          <span className="text-[11px] text-zinc-500">
                            {batchLabel}
                          </span>
                        ) : null}
                        <span className="text-[11px] text-zinc-600">
                          {section.count} 张
                        </span>
                      </header>

                      {section.title && section.index >= 0 ? (
                        <p className="mb-3 line-clamp-2 text-[12px] leading-relaxed text-zinc-500">
                          {section.title}
                        </p>
                      ) : section.title ? (
                        <p className="mb-3 line-clamp-2 text-[12px] text-zinc-500">
                          {section.title}
                        </p>
                      ) : null}

                      {section.parentBatchId && parentNum ? (
                        <button
                          type="button"
                          className="mb-3 block text-[11px] text-orange-400/90 underline-offset-2 hover:underline"
                          onClick={() => {
                            onJumpToParentBatch?.(
                              section.parentBatchId!,
                              section.sourceItemId,
                            );
                          }}
                        >
                          源自批次 {parentNum}
                        </button>
                      ) : null}

                      <div className="flex flex-wrap gap-2 sm:gap-2.5">
                        {batchItems.map((item) => {
                          const aspect =
                            item.width > 0 && item.height > 0
                              ? item.width / item.height
                              : 1;
                          return (
                            <div
                              key={item.id}
                              role="button"
                              tabIndex={0}
                              data-testid={`canvas-item-${item.id}`}
                              className={`group relative max-w-full shrink-0 overflow-hidden rounded-lg transition ${
                                selectedId === item.id
                                  ? "ring-2 ring-orange-500/90 ring-offset-2 ring-offset-[#0d0d0d]"
                                  : "ring-1 ring-transparent hover:ring-white/15"
                              } ${pulseId === item.id ? "animate-pulse ring-4 ring-orange-400/50" : ""}`}
                              style={{
                                aspectRatio: String(aspect),
                                height: "9.5rem",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  focusClickActive &&
                                  focusItem?.id === item.id
                                ) {
                                  const rect =
                                    e.currentTarget.getBoundingClientRect();
                                  const x =
                                    (e.clientX - rect.left) / rect.width;
                                  const y =
                                    (e.clientY - rect.top) / rect.height;
                                  onFocusImageClick?.(item, { x, y });
                                  hapticLight();
                                } else {
                                  onSelect(item.id);
                                  hapticLight();
                                }
                              }}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (focusClickActive) return;
                                onSetLightbox({
                                  items: batchItems,
                                  index: batchItems.findIndex(
                                    (i) => i.id === item.id,
                                  ),
                                });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  onSelect(item.id);
                                }
                              }}
                            >
                              {!readOnly ? (
                                <ScrollCanvasItemChrome
                                  item={item}
                                  selected={selectedId === item.id}
                                  readOnly={readOnly}
                                  tools={batchTools?.tools}
                                  pendingToolId={batchTools?.pendingToolId}
                                  onPreview={() => {
                                    onSetLightbox({
                                      items: batchItems,
                                      index: batchItems.findIndex(
                                        (i) => i.id === item.id,
                                      ),
                                    });
                                  }}
                                  onRefine={() => onEnterRefineMode(item.id)}
                                  onRerun={() => onRerun(item)}
                                  onDelete={() => {
                                    onSelect(item.id);
                                    onDeleteSelected();
                                  }}
                                  onDownload={
                                    onDownloadItem
                                      ? () => onDownloadItem(item)
                                      : undefined
                                  }
                                  onShare={
                                    onShareItem
                                      ? () => onShareItem(item)
                                      : undefined
                                  }
                                  onRunTool={batchTools?.onRunTool}
                                  onMentionItem={batchTools?.onMentionItem}
                                />
                              ) : null}
                              {!readOnly &&
                              selectedId === item.id &&
                              (item.outputId || item.assetId) &&
                              !(focusClickActive && focusItem?.id === item.id) ? (
                                <RefineSelectedCta
                                  onRefine={() => onEnterRefineMode(item.id)}
                                />
                              ) : null}
                              {item.isVideo ? (
                                <video
                                  src={assetUrl(item.url)}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <img
                                  src={assetUrl(item.url)}
                                  alt=""
                                  loading="lazy"
                                  className="pointer-events-none h-full w-full object-cover transition-opacity duration-300"
                                  style={{
                                    opacity: 0,
                                    backgroundColor: "#141414",
                                  }}
                                  draggable={false}
                                  onLoad={(e) => {
                                    (
                                      e.target as HTMLImageElement
                                    ).style.opacity = "1";
                                  }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                );
              })}

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
            </div>
          </div>
        )}
      </div>
    );
  },
);
