"use client";

import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { assetUrl } from "@/lib/api-client";
import type { CanvasItem, BatchSection } from "@/lib/canvas-tools";
import { batchDisplayIndex } from "@/lib/canvas-tools";
import { CanvasJobOverlay } from "@/components/canvas-job-overlay";
import { ImageActionBar, aiTools } from "@/components/image-action-bar";
import { hapticLight } from "@/lib/haptics";
import { ImagePlus } from "lucide-react";

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
  onAiToolAction?: (item: CanvasItem, action: string) => void;
  jobStreamStatus?: string | null;
  jobFailed?: boolean;
  jobProgressCompleted?: number;
  jobProgressTotal?: number;
  onOpenChatPanel?: () => void;
  focusClickActive: boolean;
  focusItem: CanvasItem | null;
  onFocusImageClick?: (
    item: CanvasItem,
    point: { x: number; y: number },
  ) => void;
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
      onAiToolAction,
      jobStreamStatus,
      jobFailed,
      jobProgressCompleted,
      jobProgressTotal,
      onOpenChatPanel,
      focusClickActive,
      focusItem,
      onFocusImageClick,
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
            completed={jobProgressCompleted}
            total={jobProgressTotal}
          />
        ) : null}

        {items.length === 0 ? (
          <div className="flex h-[min(60vh,480px)] w-full flex-col items-center justify-center gap-4 p-8">
            <div className="flex size-16 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5">
              <ImagePlus className="size-7 text-zinc-600" />
            </div>
            <div className="text-center">
              <p className="text-sm text-zinc-400">{emptyHint}</p>
              <p className="mt-1 text-xs text-zinc-600">
                在下方输入提示词，或拖拽图片到画布
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 p-4">
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
                            className="pointer-events-none w-full aspect-square bg-zinc-800 object-cover transition-opacity duration-300"
                            draggable={false}
                            onLoad={(e) => {
                              (e.target as HTMLImageElement).style.opacity =
                                "1";
                            }}
                            style={{ opacity: 0 }}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {onAiToolAction && batchItems.length > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                      {aiTools.map((aiTool) => {
                        const needsRefine = [
                          "expand",
                          "cutout",
                          "edit",
                          "upscale",
                          "enhance",
                          "remix",
                        ].includes(aiTool.action);
                        return (
                          <button
                            key={aiTool.id}
                            type="button"
                            onClick={() => {
                              const firstItem = batchItems[0];
                              if (firstItem) {
                                if (needsRefine) {
                                  onEnterRefineMode(firstItem.id);
                                  setTimeout(() => {
                                    onAiToolAction(
                                      firstItem,
                                      aiTool.action,
                                    );
                                  }, 200);
                                } else {
                                  onAiToolAction(firstItem, aiTool.action);
                                }
                              }
                            }}
                            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition ${
                              needsRefine
                                ? "bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 hover:text-orange-100"
                                : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                            }`}
                          >
                            {aiTool.icon}
                            <span>{aiTool.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  },
);
