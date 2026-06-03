"use client";

import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { assetUrl } from "@/lib/api-client";
import type { CanvasItem, BatchSection } from "@/lib/canvas-tools";
import { batchDisplayIndex } from "@/lib/canvas-tools";
import { CanvasJobOverlay } from "@/components/canvas-job-overlay";
import { ImageActionBar } from "@/components/image-action-bar";
import { BatchToolStrip } from "@/components/batch-tool-strip";
import { RefineSelectedCta } from "@/components/refine-selected-cta";
import type { StudioTool } from "@/lib/types";
import { hapticLight } from "@/lib/haptics";

export interface ScrollCanvasHandle {
  scrollToBatch: (batchId: string) => void;
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

        {items.length === 0 ? (
          <div
            className={`min-h-full w-full ${scrollBottomInset}`.trim()}
            aria-label="画布"
          />
        ) : (
          <div className={`flex flex-col gap-6 p-4 ${scrollBottomInset}`.trim()}>
            {batchSections.map((section) => {
              const batchItems = items.filter(
                (i) => i.batchId === section.id,
              );
              const parentNum = section.parentBatchId
                ? batchDisplayIndex(items, section.parentBatchId)
                : null;
              return (
                <div
                  key={section.id}
                  data-testid={`canvas-batch-section-${section.id}`}
                  className="rounded-2xl border border-white/10 bg-black/20 p-3"
                >
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-200">
                        {section.index >= 0
                          ? `批次 ${section.index + 1} · ${section.title}`
                          : section.title}
                      </p>
                      {section.subtitle ? (
                        <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                          {section.subtitle}
                        </p>
                      ) : null}
                      {section.parentBatchId && parentNum ? (
                        <button
                          type="button"
                          className="mt-1 truncate text-[11px] text-orange-400/90 underline-offset-2 hover:underline"
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
                    </div>
                    <span className="shrink-0 rounded-full border border-white/10 px-2 py-1 text-[10px] text-zinc-500">
                      {section.count} 张
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {batchItems.map((item) => (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        data-testid={`canvas-item-${item.id}`}
                        className={`group relative overflow-hidden rounded-xl border bg-zinc-900 shadow-lg transition ${
                          selectedId === item.id
                            ? "border-orange-500/80 ring-1 ring-orange-500/30"
                            : "border-white/10 hover:border-white/25"
                        } ${pulseId === item.id ? "animate-pulse ring-4 ring-orange-400/50" : ""}`}
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
                          <ImageActionBar
                            item={item}
                            selected={selectedId === item.id}
                            onPreview={() => {
                              onSetLightbox({
                                items: batchItems,
                                index: batchItems.findIndex(
                                  (i) => i.id === item.id,
                                ),
                              });
                            }}
                            onRefine={() => {
                              onEnterRefineMode(item.id);
                            }}
                            onRerun={() => {
                              onRerun(item);
                            }}
                            onDelete={() => {
                              onSelect(item.id);
                              onDeleteSelected();
                            }}
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
                        {item.label ? (
                          <span className="block bg-black/60 px-2 py-0.5 text-[10px] text-zinc-400">
                            {item.label}
                          </span>
                        ) : null}
                        {item.isVideo ? (
                          <video
                            src={assetUrl(item.url)}
                            className="w-full aspect-square object-cover"
                          />
                        ) : (
                          <img
                            src={assetUrl(item.url)}
                            alt=""
                            loading="lazy"
                            className="pointer-events-none w-full aspect-square object-contain transition-opacity duration-300"
                            style={{
                              opacity: 0,
                              backgroundColor: "#1a1a1a",
                              backgroundImage: item.url.toLowerCase().includes(".png")
                                ? `linear-gradient(45deg, #2a2a2a 25%, transparent 25%), linear-gradient(-45deg, #2a2a2a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a2a 75%), linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)`
                                : undefined,
                              backgroundSize: item.url.toLowerCase().includes(".png")
                                ? "12px 12px"
                                : undefined,
                            }}
                            draggable={false}
                            onLoad={(e) => {
                              (e.target as HTMLImageElement).style.opacity =
                                "1";
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {batchTools ? (
                    <BatchToolStrip
                      tools={batchTools.tools}
                      batchItems={batchItems}
                      selectedId={selectedId}
                      readOnly={readOnly}
                      pendingToolId={batchTools.pendingToolId}
                      onRunTool={batchTools.onRunTool}
                      onMentionItem={batchTools.onMentionItem}
                      onEnterRefineMode={onEnterRefineMode}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  },
);
