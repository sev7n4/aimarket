"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Plus } from "lucide-react";
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

const FAN_THUMB_CLASSES = [
  "left-5 top-1 z-30 rotate-0",
  "left-1 top-2 z-20 -rotate-[13deg]",
  "left-9 top-2 z-20 rotate-[13deg]",
  "left-[1.65rem] top-4 z-10 rotate-[4deg]",
];

function fanThumbClass(index: number, total: number) {
  if (total <= 1) return "left-4 top-1 z-30 rotate-0";
  if (total === 2) {
    return index === 0
      ? "left-2 top-2 z-20 -rotate-[10deg]"
      : "left-8 top-2 z-30 rotate-[10deg]";
  }
  return FAN_THUMB_CLASSES[index] ?? FAN_THUMB_CLASSES[0];
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
    const lastScrollTopRef = useRef(0);
    const [expandedRecordIds, setExpandedRecordIds] = useState<Set<string>>(
      () => new Set(),
    );

    const showJobOverlay =
      Boolean(jobStreamStatus) &&
      jobStreamStatus !== "succeeded" &&
      jobStreamStatus !== "failed";

    const itemsByBatch = useMemo(() => {
      const map = new Map<string, CanvasItem[]>();
      for (const item of items) {
        const key = item.batchId ?? "default";
        const list = map.get(key) ?? [];
        list.push(item);
        map.set(key, list);
      }
      return map;
    }, [items]);

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

    const handleScroll = useCallback(() => {
      const el = scrollContainerRef.current;
      if (!el) return;
      const delta = el.scrollTop - lastScrollTopRef.current;
      lastScrollTopRef.current = el.scrollTop;
      if (delta < -6) {
        window.dispatchEvent(
          new CustomEvent("aimarket:creation-dock-expand", {
            detail: { expanded: true },
          }),
        );
        return;
      }
      const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceToBottom < 24) {
        window.dispatchEvent(
          new CustomEvent("aimarket:creation-dock-expand", {
            detail: { expanded: false },
          }),
        );
      }
    }, []);

    return (
      <div
        ref={scrollContainerRef}
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
        onClick={() => onSelect(null)}
        onScroll={handleScroll}
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
                const batchItems = itemsByBatch.get(section.id) ?? [];
                const firstItem = batchItems[0] ?? null;
                const params = firstItem?.generationParams;
                const expanded = expandedRecordIds.has(section.id);
                const previewItems = batchItems.slice(0, 4);
                const hiddenPreviewCount = Math.max(
                  0,
                  batchItems.length - previewItems.length,
                );
                const hasRecordDetails = Boolean(params || section.title);
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
                          className="text-xl font-semibold leading-none tabular-nums text-zinc-100"
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

                      <div className="mb-3 flex items-start gap-2.5 rounded-2xl border border-white/5 bg-white/[0.025] px-2.5 py-2">
                        <div className="relative h-[4.6rem] w-[5.65rem] shrink-0">
                          {previewItems.map((thumb, thumbIdx) => (
                            <div
                              key={`thumb-${thumb.id}`}
                              className={`group/thumb absolute size-[3.35rem] overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-[0_10px_22px_rgba(0,0,0,0.36)] transition duration-200 hover:z-40 hover:rotate-0 hover:scale-105 ${fanThumbClass(
                                thumbIdx,
                                previewItems.length,
                              )}`}
                            >
                              {thumb.isVideo ? (
                                <video
                                  src={assetUrl(thumb.url)}
                                  className="h-full w-full object-cover"
                                  preload="none"
                                />
                              ) : (
                                <img
                                  src={assetUrl(thumb.thumbUrl ?? thumb.url)}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                  className="h-full w-full object-cover"
                                />
                              )}
                              {batchTools?.onMentionItem &&
                              (thumb.outputId || thumb.assetId) ? (
                                <button
                                  type="button"
                                  aria-label="引用缩略图到工作台"
                                  title="引用到工作台"
                                  className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition group-hover/thumb:opacity-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    batchTools.onMentionItem?.(thumb);
                                  }}
                                >
                                  <span className="flex size-7 items-center justify-center rounded-full bg-orange-500 shadow-lg">
                                    <Plus className="size-4" />
                                  </span>
                                </button>
                              ) : null}
                            </div>
                          ))}
                          {hiddenPreviewCount > 0 ? (
                            <span className="absolute bottom-0 right-0 z-50 rounded-full border border-white/10 bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-zinc-200 shadow-lg">
                              +{hiddenPreviewCount}
                            </span>
                          ) : null}
                        </div>
                        <div className="relative min-w-0 flex-1 pr-5">
                          {section.title ? (
                            <p
                              className={`${expanded ? "" : "line-clamp-2"} text-[12px] leading-relaxed text-zinc-300`}
                            >
                              {section.title}
                            </p>
                          ) : null}
                          {params ? (
                            <dl
                              className={`mt-2 grid gap-1 text-[11px] leading-relaxed text-zinc-500 sm:grid-cols-2 ${
                                expanded ? "" : "max-h-[2.9rem] overflow-hidden"
                              }`}
                            >
                              <div>
                                <dt className="inline text-zinc-600">模型：</dt>
                                <dd className="inline">{params.modelId ?? "-"}</dd>
                              </div>
                              <div>
                                <dt className="inline text-zinc-600">比例：</dt>
                                <dd className="inline">{params.aspectRatio ?? "-"}</dd>
                              </div>
                              <div>
                                <dt className="inline text-zinc-600">分辨率：</dt>
                                <dd className="inline">{params.resolution ?? "-"}</dd>
                              </div>
                              <div>
                                <dt className="inline text-zinc-600">工具：</dt>
                                <dd className="inline">{params.toolType ?? "生成"}</dd>
                              </div>
                              <div>
                                <dt className="inline text-zinc-600">输出：</dt>
                                <dd className="inline">{section.count} 张</dd>
                              </div>
                              <div className="sm:col-span-2">
                                <dt className="inline text-zinc-600">Prompt：</dt>
                                <dd className="inline whitespace-pre-wrap">
                                  {params.prompt || section.title}
                                </dd>
                              </div>
                            </dl>
                          ) : null}
                          {hasRecordDetails && !expanded ? (
                            <button
                              type="button"
                              aria-label="展开完整操作记录"
                              title="展开完整操作记录"
                              className="absolute bottom-0 right-0 rounded-full px-1 text-[13px] font-semibold leading-none text-orange-300 transition hover:bg-orange-500/15 hover:text-orange-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedRecordIds((prev) => {
                                  const next = new Set(prev);
                                  next.add(section.id);
                                  return next;
                                });
                              }}
                            >
                              ...
                            </button>
                          ) : null}
                        </div>
                      </div>

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
                              preload="none"
                                />
                              ) : (
                                <img
                              src={assetUrl(item.thumbUrl ?? item.url)}
                                  alt=""
                                  loading="lazy"
                              decoding="async"
                              fetchPriority={sectionIdx < 2 ? "high" : "low"}
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
