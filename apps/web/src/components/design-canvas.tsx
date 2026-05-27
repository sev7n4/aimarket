"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { assetUrl } from "@/lib/api-client";
import type { CanvasItem, CanvasToolId } from "@/lib/canvas-tools";
import { CanvasToolbar } from "@/components/canvas-toolbar";
import { CanvasJobOverlay } from "@/components/canvas-job-overlay";
import { CanvasContextMenu } from "@/components/canvas-context-menu";
import { MOBILE_BREAKPOINT } from "@/lib/breakpoints";
import { canvasSelectionHint } from "@/lib/mobile-labels";
import { hapticLight } from "@/lib/haptics";
import { useIsMobile } from "@/hooks/use-is-mobile";

export interface DesignCanvasHandle {
  fitToItem: (itemId: string) => void;
  pulseItem: (itemId: string) => void;
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
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [tool, setTool] = useState<CanvasToolId>("select");
    const [gridOn, setGridOn] = useState(true);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [pulseId, setPulseId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{
      item: CanvasItem;
      x: number;
      y: number;
    } | null>(null);
    const mobile = useIsMobile(MOBILE_BREAKPOINT);
    const touchUi = mobile;
    const zoomStep = touchUi ? 0.28 : 0.15;
    const wheelZoomStep = touchUi ? 0.22 : 0.08;
    const panGain = touchUi ? 1.35 : 1;
    const panStart = useRef<{
      x: number;
      y: number;
      px: number;
      py: number;
    } | null>(null);
    const dragRef = useRef<{
      id: string;
      startX: number;
      startY: number;
      originX: number;
      originY: number;
    } | null>(null);
    const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fitToItem = useCallback((itemId: string) => {
      const item = items.find((i) => i.id === itemId);
      const container = containerRef.current;
      if (!item || !container) return;

      const rect = container.getBoundingClientRect();
      const pad = 48;
      const scaleX = (rect.width - pad * 2) / item.width;
      const scaleY = (rect.height - pad * 2) / item.height;
      const nextZoom = Math.min(2, Math.max(0.35, Math.min(scaleX, scaleY)));
      const cx = item.x + item.width / 2;
      const cy = item.y + item.height / 2;
      setZoom(nextZoom);
      setPan({
        x: rect.width / 2 - cx * nextZoom,
        y: rect.height / 2 - cy * nextZoom,
      });
    }, [items]);

    const pulseItem = useCallback((itemId: string) => {
      setPulseId(itemId);
      hapticLight();
      window.setTimeout(() => setPulseId(null), 2000);
    }, []);

    useImperativeHandle(ref, () => ({ fitToItem, pulseItem }), [
      fitToItem,
      pulseItem,
    ]);

    const handleTool = useCallback(
      (id: CanvasToolId) => {
        if (id === "zoom-in") setZoom((z) => Math.min(2, z + zoomStep));
        else if (id === "zoom-out")
          setZoom((z) => Math.max(0.35, z - zoomStep));
        else if (id === "fit") {
          setZoom(1);
          setPan({ x: 0, y: 0 });
        } else if (id === "grid") setGridOn((g) => !g);
        else if (id === "upload") {
          if (!readOnly) onUpload();
        } else if (id === "download") onDownload();
        else if (id === "delete") {
          if (readOnly) return;
          if (selectedId) onDeleteSelected();
          else setTool("select");
        } else setTool(id);
      },
      [onUpload, onDownload, onDeleteSelected, selectedId, readOnly, zoomStep],
    );

    function onCanvasPointerDown(e: React.PointerEvent) {
      if (tool !== "pan") return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        px: pan.x,
        py: pan.y,
      };
    }

    function onCanvasPointerMove(e: React.PointerEvent) {
      if (!readOnly && dragRef.current && tool === "select") {
        const d = dragRef.current;
        const dx = (e.clientX - d.startX) / zoom;
        const dy = (e.clientY - d.startY) / zoom;
        onItemsChange(
          items.map((it) =>
            it.id === d.id
              ? { ...it, x: d.originX + dx, y: d.originY + dy }
              : it,
          ),
        );
        return;
      }
      if (!panStart.current || tool !== "pan") return;
      setPan({
        x: panStart.current.px + (e.clientX - panStart.current.x) * panGain,
        y: panStart.current.py + (e.clientY - panStart.current.y) * panGain,
      });
    }

    function endPointer() {
      panStart.current = null;
      dragRef.current = null;
      if (longPressRef.current) {
        clearTimeout(longPressRef.current);
        longPressRef.current = null;
      }
    }

    function onItemPointerDown(e: React.PointerEvent, item: CanvasItem) {
      if (tool !== "select") return;
      e.stopPropagation();
      onSelect(item.id);
      hapticLight();

      if (mobile && !readOnly) {
        longPressRef.current = setTimeout(() => {
          setContextMenu({ item, x: e.clientX, y: e.clientY });
          hapticLight();
        }, 500);
      }

      if (readOnly) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        id: item.id,
        startX: e.clientX,
        startY: e.clientY,
        originX: item.x,
        originY: item.y,
      };
    }

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      function onWheel(e: WheelEvent) {
        const pinchZoom = e.ctrlKey || e.metaKey;
        const touchPinch = touchUi && !pinchZoom;
        if (pinchZoom || touchPinch) {
          e.preventDefault();
          const delta = e.deltaY > 0 ? -wheelZoomStep : wheelZoomStep;
          setZoom((z) => Math.min(2, Math.max(0.35, z + delta)));
        }
      }
      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    }, [touchUi, wheelZoomStep]);

    useEffect(() => {
      function onKey(e: KeyboardEvent) {
        if (e.key !== "Delete" && e.key !== "Backspace") return;
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (readOnly || !selectedId) return;
        e.preventDefault();
        onDeleteSelected();
      }
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [selectedId, onDeleteSelected, readOnly]);

    const showJobOverlay =
      Boolean(jobStreamStatus) &&
      jobStreamStatus !== "succeeded" &&
      jobStreamStatus !== "failed";

    return (
      <div
        className={`flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d0d] ${
          mobile ? "flex-col" : "flex-row"
        }`}
      >
        {!mobile ? (
          <CanvasToolbar active={tool} gridOn={gridOn} onTool={handleTool} />
        ) : null}

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {selectSourceBanner ? (
            <div className="absolute left-2 right-2 top-2 z-20 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
              {selectSourceBanner}
            </div>
          ) : null}

          <div
            ref={containerRef}
            className={`relative min-h-0 flex-1 touch-none overflow-hidden ${
              tool === "pan"
                ? "cursor-grab active:cursor-grabbing"
                : "cursor-default"
            }`}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={endPointer}
            onPointerLeave={endPointer}
            onClick={() => tool === "select" && onSelect(null)}
          >
            {showJobOverlay || jobFailed ? (
              <CanvasJobOverlay
                status={jobStreamStatus}
                failed={jobFailed}
                onOpenChat={onOpenChatPanel}
                completed={jobProgressCompleted}
                total={jobProgressTotal}
              />
            ) : null}

            {gridOn ? (
              <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
                  backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
                  backgroundPosition: `${pan.x}px ${pan.y}px`,
                }}
              />
            ) : (
              <div className="pointer-events-none absolute inset-0 bg-[#0d0d0d]" />
            )}

            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
            >
              {items.length === 0 ? (
                <div className="flex h-[min(60vh,480px)] w-[min(90vw,720px)] items-center justify-center p-8">
                  <p className="text-sm text-zinc-600">{emptyHint}</p>
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    style={{
                      position: "absolute",
                      left: item.x,
                      top: item.y,
                      width: item.width,
                    }}
                    onPointerDown={(e) => onItemPointerDown(e, item)}
                    onClick={(e) => e.stopPropagation()}
                    className={`overflow-hidden rounded-xl border-2 bg-zinc-900 text-left shadow-lg transition ${
                      tool === "select"
                        ? "cursor-grab active:cursor-grabbing"
                        : ""
                    } ${
                      selectedId === item.id
                        ? "border-orange-500 ring-2 ring-orange-500/30"
                        : "border-white/10 hover:border-white/25"
                    } ${pulseId === item.id ? "animate-pulse ring-4 ring-orange-400/50" : ""}`}
                  >
                    {item.label ? (
                      <span className="block bg-black/60 px-2 py-0.5 text-[10px] text-zinc-400">
                        {item.label}
                      </span>
                    ) : null}
                    {item.isVideo ? (
                      <video
                        src={assetUrl(item.url)}
                        className="w-full object-cover"
                        style={{ height: item.height }}
                      />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={assetUrl(item.url)}
                        alt=""
                        className="pointer-events-none w-full object-cover"
                        style={{ height: item.height }}
                        draggable={false}
                      />
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="absolute bottom-3 right-3 rounded-lg bg-black/60 px-2 py-1 text-[10px] text-zinc-500">
              {Math.round(zoom * 100)}%
              {canvasSelectionHint(mobile, Boolean(selectedId))}
            </div>
          </div>

          {mobile ? (
            <CanvasToolbar
              active={tool}
              gridOn={gridOn}
              onTool={handleTool}
              layout="horizontal"
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
      </div>
    );
  },
);
