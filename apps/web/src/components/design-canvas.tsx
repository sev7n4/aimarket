"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  CanvasItem,
  CanvasMaskSelection,
  CanvasToolId,
  CanvasLayoutMode,
} from "@/lib/canvas-tools";
import { pickLatestBatchId } from "@/lib/canvas-tools";
import { CanvasToolbar } from "@/components/canvas-toolbar";
import { CanvasContextMenu } from "@/components/canvas-context-menu";
import { CanvasLightbox } from "@/components/canvas-lightbox";
import { ScrollCanvas } from "@/components/scroll-canvas";
import type { ScrollCanvasHandle } from "@/components/scroll-canvas";
import { FreeCanvas } from "@/components/free-canvas";
import type { FreeCanvasHandle } from "@/components/free-canvas";
import { MOBILE_BREAKPOINT } from "@/lib/breakpoints";
import { hapticLight } from "@/lib/haptics";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { ArrowLeft, Grid3X3, Layout } from "lucide-react";

export interface DesignCanvasHandle {
  fitToItem: (itemId: string) => void;
  fitToBatch: (batchId: string) => void;
  pulseItem: (itemId: string) => void;
  fitAll: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  enterRefineMode: (itemId: string) => void;
  exitRefineMode: () => void;
}

interface DesignCanvasProps {
  items: CanvasItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onItemsChange: (items: CanvasItem[]) => void;
  onUpload: () => void;
  onDownload: () => void;
  onDeleteSelected: () => void;
  emptyHint?: string;
  readOnly?: boolean;
  jobStreamStatus?: string | null;
  jobFailed?: boolean;
  jobProgressCompleted?: number;
  jobProgressTotal?: number;
  onOpenChatPanel?: () => void;
  selectSourceBanner?: string | null;
  onCutoutItem?: (item: CanvasItem) => void;
  onExpandItem?: (item: CanvasItem) => void;
  brushRequest?: {
    key: number;
    itemId: string;
    toolId: string;
    toolName: string;
  } | null;
  onBrushComplete?: (selection: CanvasMaskSelection) => void;
  onBrushCancel?: () => void;
  focusClickRequest?: {
    key: number;
    itemId: string;
    toolName: string;
    markers: Array<{ x: number; y: number; label: string }>;
  } | null;
  onFocusImageClick?: (
    item: CanvasItem,
    point: { x: number; y: number },
  ) => void;
  onFocusClickCancel?: () => void;
  selectionToolbar?: ReactNode;
  statusChip?: ReactNode;
  onJumpToParentBatch?: (
    parentBatchId: string,
    sourceItemId?: string,
  ) => void;
  onAiToolAction?: (item: CanvasItem, action: string) => void;
  onRerun?: (item: CanvasItem) => void;
  layoutMode?: CanvasLayoutMode;
  onLayoutModeChange?: (mode: CanvasLayoutMode) => void;
}

export const DesignCanvas = forwardRef<DesignCanvasHandle, DesignCanvasProps>(
  function DesignCanvas(
    {
      items,
      selectedId,
      onSelect,
      onItemsChange,
      onUpload,
      onDownload,
      onDeleteSelected,
      emptyHint = "生成结果将显示在画布上",
      readOnly = false,
      jobStreamStatus = null,
      jobFailed = false,
      jobProgressCompleted = 0,
      jobProgressTotal = 0,
      onOpenChatPanel,
      selectSourceBanner = null,
      onCutoutItem,
      onExpandItem,
      brushRequest = null,
      onBrushComplete,
      onBrushCancel,
      focusClickRequest = null,
      onFocusImageClick,
      onFocusClickCancel,
      selectionToolbar = null,
      statusChip = null,
      onJumpToParentBatch,
      onAiToolAction,
      onRerun,
      layoutMode = "scroll",
      onLayoutModeChange,
    },
    ref,
  ) {
    const scrollCanvasRef = useRef<ScrollCanvasHandle>(null);
    const freeCanvasRef = useRef<FreeCanvasHandle>(null);
    const [tool, setTool] = useState<CanvasToolId>("select");
    const [gridOn, setGridOn] = useState(true);
    const [pulseId, setPulseId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{
      item: CanvasItem;
      x: number;
      y: number;
    } | null>(null);
    const [lightbox, setLightbox] = useState<{
      items: CanvasItem[];
      index: number;
    } | null>(null);
    const [internalLayoutMode, setInternalLayoutMode] =
      useState<CanvasLayoutMode>(layoutMode);
    const [refineItemId, setRefineItemId] = useState<string | null>(null);
    const mobile = useIsMobile(MOBILE_BREAKPOINT);

    const refineItem = refineItemId
      ? items.find((item) => item.id === refineItemId)
      : null;
    const isRefineMode = Boolean(
      refineItemId && refineItem && internalLayoutMode === "free",
    );

    const focusItem = focusClickRequest
      ? items.find((item) => item.id === focusClickRequest.itemId)
      : null;
    const focusClickActive = Boolean(focusClickRequest && focusItem);

    const historyRef = useRef<CanvasItem[][]>([]);
    const historyIndexRef = useRef<number>(-1);
    const canUndo = historyIndexRef.current > 0;
    const canRedo = historyIndexRef.current < historyRef.current.length - 1;

    useEffect(() => {
      if (layoutMode !== internalLayoutMode) {
        setInternalLayoutMode(layoutMode);
      }
    }, [layoutMode]);

    const pushHistory = useCallback((newItems: CanvasItem[]) => {
      const currentHistory = historyRef.current;
      const currentIndex = historyIndexRef.current;
      if (currentIndex < currentHistory.length - 1) {
        currentHistory.splice(currentIndex + 1);
      }
      currentHistory.push(newItems);
      historyIndexRef.current = currentHistory.length - 1;
      if (currentHistory.length > 50) {
        currentHistory.shift();
        historyIndexRef.current -= 1;
      }
    }, []);

    useEffect(() => {
      if (items.length > 0 && historyRef.current.length === 0) {
        historyRef.current = [items];
        historyIndexRef.current = 0;
      }
    }, [items]);

    const undo = useCallback(() => {
      if (historyIndexRef.current <= 0) return;
      historyIndexRef.current -= 1;
      const prevItems = historyRef.current[historyIndexRef.current];
      if (prevItems) {
        onItemsChange(prevItems);
      }
    }, [onItemsChange]);

    const redo = useCallback(() => {
      if (historyIndexRef.current >= historyRef.current.length - 1) return;
      historyIndexRef.current += 1;
      const nextItems = historyRef.current[historyIndexRef.current];
      if (nextItems) {
        onItemsChange(nextItems);
      }
    }, [onItemsChange]);

    const handleItemsChangeWithHistory = useCallback(
      (newItems: CanvasItem[]) => {
        pushHistory(newItems);
        onItemsChange(newItems);
      },
      [pushHistory, onItemsChange],
    );

    const pulseItem = useCallback((itemId: string) => {
      setPulseId(itemId);
      hapticLight();
      window.setTimeout(() => setPulseId(null), 2000);
    }, []);

    const enterRefineMode = useCallback(
      (itemId: string) => {
        const item = items.find((i) => i.id === itemId);
        if (!item) return;
        
        if (item.x === 0 && item.y === 0) {
          const canvasWidth = 800;
          const canvasHeight = 600;
          const newItem = {
            ...item,
            x: canvasWidth / 2 - item.width / 2,
            y: canvasHeight / 2 - item.height / 2,
          };
          const newItems = items.map((i) =>
            i.id === itemId ? newItem : i,
          );
          onItemsChange(newItems);
        }
        
        setRefineItemId(itemId);
        setInternalLayoutMode("free");
        onLayoutModeChange?.("free");
        onSelect(itemId);
        setTimeout(() => {
          freeCanvasRef.current?.fitToItem(itemId);
        }, 100);
      },
      [items, onItemsChange, onLayoutModeChange, onSelect],
    );

    const exitRefineMode = useCallback(() => {
      const batchId = refineItem?.batchId;
      setRefineItemId(null);
      setInternalLayoutMode("scroll");
      onLayoutModeChange?.("scroll");
      if (batchId) {
        setTimeout(() => {
          scrollCanvasRef.current?.scrollToBatch(batchId);
        }, 100);
      }
    }, [refineItem, onLayoutModeChange]);

    useEffect(() => {
      if (!refineItemId) return;
      const item = items.find((i) => i.id === refineItemId);
      if (!item) {
        setRefineItemId(null);
        setInternalLayoutMode("scroll");
        onLayoutModeChange?.("scroll");
      }
    }, [items, refineItemId, onLayoutModeChange]);

    useImperativeHandle(
      ref,
      () => ({
        fitToItem: (itemId: string) =>
          freeCanvasRef.current?.fitToItem(itemId),
        fitToBatch: (batchId: string) =>
          freeCanvasRef.current?.fitToBatch(batchId),
        pulseItem,
        fitAll: () => freeCanvasRef.current?.fitAll(),
        undo,
        redo,
        canUndo,
        canRedo,
        enterRefineMode,
        exitRefineMode,
      }),
      [pulseItem, undo, redo, canUndo, canRedo, enterRefineMode, exitRefineMode],
    );

    useEffect(() => {
      if (!brushRequest) return;
      if (internalLayoutMode !== "free") {
        setInternalLayoutMode("free");
        onLayoutModeChange?.("free");
      }
    }, [brushRequest, internalLayoutMode, onLayoutModeChange]);

    useEffect(() => {
      if (!focusClickRequest) return;
      if (internalLayoutMode !== "free") {
        setInternalLayoutMode("free");
        onLayoutModeChange?.("free");
      }
    }, [focusClickRequest, internalLayoutMode, onLayoutModeChange]);

    const handleTool = useCallback(
      (id: CanvasToolId) => {
        if (id === "zoom-in") {
          freeCanvasRef.current?.zoomIn();
          return;
        }
        if (id === "zoom-out") {
          freeCanvasRef.current?.zoomOut();
          return;
        }
        if (id === "fit") {
          const latestBatch = pickLatestBatchId(items);
          if (latestBatch) freeCanvasRef.current?.fitToBatch(latestBatch);
          else freeCanvasRef.current?.fitAll();
          return;
        }
        if (id === "grid") {
          setGridOn((g) => !g);
          return;
        }
        if (id === "upload") {
          if (!readOnly) onUpload();
          return;
        }
        if (id === "download") {
          onDownload();
          return;
        }
        if (id === "delete") {
          if (readOnly) return;
          if (selectedId) onDeleteSelected();
          else setTool("select");
          return;
        }
        if (id === "undo") {
          undo();
          return;
        }
        if (id === "redo") {
          redo();
          return;
        }
        if (id === "layout-scroll") {
          setInternalLayoutMode("scroll");
          onLayoutModeChange?.("scroll");
          return;
        }
        if (id === "layout-free") {
          const targetId = selectedId ?? items[0]?.id;
          if (targetId) {
            setRefineItemId(targetId);
            onSelect(targetId);
          }
          setInternalLayoutMode("free");
          onLayoutModeChange?.("free");
          if (targetId) {
            setTimeout(() => {
              freeCanvasRef.current?.fitToItem(targetId);
            }, 100);
          }
          return;
        }
        if (id === "preview") {
          if (items.length > 0) {
            const startIndex = selectedId
              ? items.findIndex((i) => i.id === selectedId)
              : 0;
            setLightbox({
              items,
              index: startIndex >= 0 ? startIndex : 0,
            });
          }
          return;
        }
        setTool(id);
        if (internalLayoutMode === "free") {
          freeCanvasRef.current?.setZoomForTool(id);
        }
      },
      [
        onUpload,
        onDownload,
        onDeleteSelected,
        selectedId,
        readOnly,
        items,
        undo,
        redo,
        onLayoutModeChange,
        internalLayoutMode,
      ],
    );

    useEffect(() => {
      let spaceHeld = false;
      function onKey(e: KeyboardEvent) {
        const tag = (e.target as HTMLElement).tagName;
        const inInput =
          tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

        if (e.key === " " && !inInput && internalLayoutMode === "free") {
          e.preventDefault();
          if (!spaceHeld) {
            spaceHeld = true;
            setTool("pan");
          }
          return;
        }

        if (e.key === "Delete" || e.key === "Backspace") {
          if (inInput) return;
          if (readOnly || !selectedId) return;
          e.preventDefault();
          onDeleteSelected();
        } else if ((e.metaKey || e.ctrlKey) && e.key === "z") {
          if (inInput) return;
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (e.key === "Escape") {
          if (refineItemId && internalLayoutMode === "free") {
            exitRefineMode();
          } else if (tool !== "select") {
            setTool("select");
          }
        }
      }
      function onKeyUp(e: KeyboardEvent) {
        if (e.key === " " && spaceHeld) {
          spaceHeld = false;
          setTool("select");
        }
      }
      window.addEventListener("keydown", onKey);
      window.addEventListener("keyup", onKeyUp);
      return () => {
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("keyup", onKeyUp);
      };
    }, [
      selectedId,
      onDeleteSelected,
      readOnly,
      undo,
      redo,
      refineItemId,
      internalLayoutMode,
      exitRefineMode,
      tool,
    ]);

    const batchSections = useMemo(() => {
      const groups = new Map<string, CanvasItem[]>();
      for (const item of items) {
        const key = item.batchId ?? `item-${item.id}`;
        groups.set(key, [...(groups.get(key) ?? []), item]);
      }
      return Array.from(groups.entries())
        .map(([id, batchItems]) => {
          const minX = Math.min(...batchItems.map((i) => i.x));
          const minY = Math.min(...batchItems.map((i) => i.y));
          const maxX = Math.max(...batchItems.map((i) => i.x + i.width));
          const maxY = Math.max(...batchItems.map((i) => i.y + i.height));
          const first = batchItems[0];
          return {
            id,
            index: first.batchIndex ?? 0,
            title: first.batchTitle ?? "批次",
            subtitle: first.batchSubtitle,
            parentBatchId: first.parentBatchId,
            sourceItemId: first.sourceItemId,
            count: batchItems.length,
            x: minX - 24,
            y: minY - 58,
            width: maxX - minX + 48,
            height: maxY - minY + 88,
          };
        })
        .sort((a, b) => a.index - b.index || a.y - b.y);
    }, [items]);

    return (
      <div
        className={`flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d0d] ${
          mobile ? "flex-col" : "flex-row"
        }`}
      >
        {!mobile ? (
          <CanvasToolbar
            active={tool}
            gridOn={gridOn}
            onTool={handleTool}
            layoutMode={internalLayoutMode}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        ) : null}

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {selectSourceBanner ? (
            <div className="absolute left-2 right-2 top-2 z-20 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
              {selectSourceBanner}
            </div>
          ) : null}

          <div className="absolute left-2 top-2 z-20 flex items-center gap-1">
            {isRefineMode ? (
              <button
                type="button"
                onClick={exitRefineMode}
                className="flex items-center gap-1.5 rounded-lg bg-orange-500/20 px-3 py-1.5 text-xs text-orange-300 transition hover:bg-orange-500/30 hover:text-orange-100"
              >
                <ArrowLeft className="size-3.5" />
                <span>返回纵向模式</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  handleTool(
                    internalLayoutMode === "scroll"
                      ? "layout-free"
                      : "layout-scroll",
                  )
                }
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition ${
                  internalLayoutMode === "scroll"
                    ? "bg-white/15 text-white"
                    : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                }`}
                title={internalLayoutMode === "scroll" ? "切换到自由布局" : "切换到纵向滚动"}
              >
                {internalLayoutMode === "scroll" ? (
                  <Grid3X3 className="size-3.5" />
                ) : (
                  <Layout className="size-3.5" />
                )}
                <span>{internalLayoutMode === "scroll" ? "纵向滚动" : "自由布局"}</span>
              </button>
            )}
          </div>

          {focusClickActive && focusClickRequest ? (
            <div
              data-testid="focus-edit-canvas-banner"
              className="absolute left-2 right-2 top-2 z-30 rounded-2xl border border-purple-400/30 bg-black/80 p-2 text-xs text-zinc-200 shadow-xl backdrop-blur"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-purple-200">
                  {focusClickRequest.toolName}：点击图片添加焦点
                </span>
                <button
                  type="button"
                  onClick={onFocusClickCancel}
                  className="ml-auto rounded-full bg-white/10 px-2.5 py-1 text-zinc-300"
                >
                  完成点选
                </button>
              </div>
              <p className="mt-1 text-[10px] text-zinc-500">
                在工作站输入短 prompt
                后提交；最多 10 个焦点，连续点击间隔约 1.5 秒。
              </p>
            </div>
          ) : null}

          {internalLayoutMode === "scroll" ? (
            <ScrollCanvas
              ref={scrollCanvasRef}
              items={items}
              batchSections={batchSections}
              selectedId={selectedId}
              onSelect={onSelect}
              readOnly={readOnly}
              emptyHint={emptyHint}
              pulseId={pulseId}
              onEnterRefineMode={enterRefineMode}
              onSetLightbox={setLightbox}
              onDeleteSelected={onDeleteSelected}
              onRerun={(item) => onRerun?.(item)}
              onJumpToParentBatch={onJumpToParentBatch}
              onAiToolAction={onAiToolAction}
              jobStreamStatus={jobStreamStatus}
              jobFailed={jobFailed}
              jobProgressCompleted={jobProgressCompleted}
              jobProgressTotal={jobProgressTotal}
              onOpenChatPanel={onOpenChatPanel}
              focusClickActive={focusClickActive}
              focusItem={focusItem ?? null}
              onFocusImageClick={onFocusImageClick}
            />
          ) : (
            <FreeCanvas
              ref={freeCanvasRef}
              items={items}
              batchSections={batchSections}
              selectedId={selectedId}
              onSelect={onSelect}
              onItemsChangeWithHistory={handleItemsChangeWithHistory}
              readOnly={readOnly}
              emptyHint={emptyHint}
              pulseId={pulseId}
              isRefineMode={isRefineMode}
              refineItemId={refineItemId}
              onEnterRefineMode={enterRefineMode}
              onExitRefineMode={exitRefineMode}
              onSetLightbox={setLightbox}
              onSetContextMenu={setContextMenu}
              onJumpToParentBatch={onJumpToParentBatch}
              onDeleteSelected={onDeleteSelected}
              onRerun={(item) => onRerun?.(item)}
              tool={tool}
              onToolChange={setTool}
              gridOn={gridOn}
              brushRequest={brushRequest}
              onBrushComplete={onBrushComplete}
              onBrushCancel={onBrushCancel}
              focusClickRequest={focusClickRequest}
              onFocusImageClick={onFocusImageClick}
              onFocusClickCancel={onFocusClickCancel}
              selectionToolbar={selectionToolbar}
              statusChip={statusChip}
              jobStreamStatus={jobStreamStatus}
              jobFailed={jobFailed}
              jobProgressCompleted={jobProgressCompleted}
              jobProgressTotal={jobProgressTotal}
              onOpenChatPanel={onOpenChatPanel}
              mobile={mobile}
            />
          )}

          {mobile ? (
            <CanvasToolbar
              active={tool}
              gridOn={gridOn}
              onTool={handleTool}
              layout="horizontal"
              layoutMode={internalLayoutMode}
              canUndo={canUndo}
              canRedo={canRedo}
            />
          ) : null}
        </div>

        {contextMenu ? (
          <CanvasContextMenu
            item={contextMenu.item}
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onDownload={() => {
              onSelect(contextMenu.item.id);
              onDownload();
            }}
            onDelete={() => {
              onSelect(contextMenu.item.id);
              onDeleteSelected();
            }}
            onCutout={
              onCutoutItem && contextMenu.item.outputId
                ? () => onCutoutItem(contextMenu.item)
                : undefined
            }
            onExpand={
              onExpandItem && contextMenu.item.outputId
                ? () => onExpandItem(contextMenu.item)
                : undefined
            }
          />
        ) : null}

        {lightbox && (
          <CanvasLightbox
            items={lightbox.items}
            initialIndex={lightbox.index}
            onClose={() => setLightbox(null)}
          />
        )}
      </div>
    );
  },
);
