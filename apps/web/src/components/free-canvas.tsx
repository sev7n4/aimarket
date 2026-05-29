"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { assetUrl } from "@/lib/api-client";
import type {
  CanvasItem,
  CanvasMaskSelection,
  CanvasToolId,
  BatchSection,
} from "@/lib/canvas-tools";
import { batchDisplayIndex } from "@/lib/canvas-tools";
import { CanvasJobOverlay } from "@/components/canvas-job-overlay";
import { ImageActionBar } from "@/components/image-action-bar";
import { hapticLight } from "@/lib/haptics";
import { canvasSelectionHint } from "@/lib/mobile-labels";
import { Minus, Plus, ImagePlus } from "lucide-react";

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 6;

export interface FreeCanvasHandle {
  fitToItem: (itemId: string) => void;
  fitToBatch: (batchId: string) => void;
  fitAll: () => void;
  resetView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setZoomForTool: (toolId: string) => void;
}

interface FreeCanvasProps {
  items: CanvasItem[];
  batchSections: BatchSection[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onItemsChangeWithHistory: (items: CanvasItem[]) => void;
  readOnly: boolean;
  emptyHint: string;
  pulseId: string | null;
  isRefineMode: boolean;
  refineItemId: string | null;
  onEnterRefineMode: (itemId: string) => void;
  onExitRefineMode: () => void;
  onSetLightbox: (lb: { items: CanvasItem[]; index: number } | null) => void;
  onSetContextMenu: (cm: {
    item: CanvasItem;
    x: number;
    y: number;
  } | null) => void;
  onJumpToParentBatch?: (
    parentBatchId: string,
    sourceItemId?: string,
  ) => void;
  onDeleteSelected: () => void;
  tool: CanvasToolId;
  onToolChange: (tool: CanvasToolId) => void;
  gridOn: boolean;
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
  jobStreamStatus?: string | null;
  jobFailed?: boolean;
  jobProgressCompleted?: number;
  jobProgressTotal?: number;
  onOpenChatPanel?: () => void;
  mobile: boolean;
}

export const FreeCanvas = forwardRef<FreeCanvasHandle, FreeCanvasProps>(
  function FreeCanvas(
    {
      items,
      batchSections,
      selectedId,
      onSelect,
      onItemsChangeWithHistory,
      readOnly,
      emptyHint,
      pulseId,
      isRefineMode,
      refineItemId,
      onEnterRefineMode,
      onExitRefineMode,
      onSetLightbox,
      onSetContextMenu,
      onJumpToParentBatch,
      onDeleteSelected,
      tool,
      onToolChange,
      gridOn,
      brushRequest = null,
      onBrushComplete,
      onBrushCancel,
      focusClickRequest = null,
      onFocusImageClick,
      onFocusClickCancel,
      selectionToolbar = null,
      statusChip = null,
      jobStreamStatus = null,
      jobFailed = false,
      jobProgressCompleted = 0,
      jobProgressTotal = 0,
      onOpenChatPanel,
      mobile,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [maskMode, setMaskMode] = useState<"brush" | "box">("brush");
    const [maskStrokes, setMaskStrokes] = useState<
      Array<Array<{ x: number; y: number }>>
    >([]);
    const [maskBoxes, setMaskBoxes] = useState<
      Array<{ x: number; y: number; width: number; height: number }>
    >([]);
    const activeStrokeRef = useRef<Array<{ x: number; y: number }> | null>(
      null,
    );
    const activeBoxRef = useRef<{ x: number; y: number } | null>(null);
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

    const touchUi = mobile;
    const zoomStep = touchUi ? 0.28 : 0.15;
    const wheelZoomStep = touchUi ? 0.22 : 0.08;
    const panGain = touchUi ? 1.35 : 1;

    const brushItem = brushRequest
      ? items.find((item) => item.id === brushRequest.itemId)
      : null;
    const brushActive = Boolean(brushRequest && brushItem);
    const focusItem = focusClickRequest
      ? items.find((item) => item.id === focusClickRequest.itemId)
      : null;
    const focusClickActive = Boolean(focusClickRequest && focusItem);

    const showJobOverlay =
      Boolean(jobStreamStatus) &&
      jobStreamStatus !== "succeeded" &&
      jobStreamStatus !== "failed";

    const fitToItem = useCallback(
      (itemId: string) => {
        const item = items.find((i) => i.id === itemId);
        const container = containerRef.current;
        if (!item || !container) return;
        const rect = container.getBoundingClientRect();
        const pad = 48;
        const scaleX = (rect.width - pad * 2) / item.width;
        const scaleY = (rect.height - pad * 2) / item.height;
        const nextZoom = Math.min(
          ZOOM_MAX,
          Math.max(ZOOM_MIN, Math.min(scaleX, scaleY)),
        );
        const cx = item.x + item.width / 2;
        const cy = item.y + item.height / 2;
        setZoom(nextZoom);
        setPan({
          x: rect.width / 2 - cx * nextZoom,
          y: rect.height / 2 - cy * nextZoom,
        });
      },
      [items],
    );

    const fitToBatch = useCallback(
      (batchId: string) => {
        const batchItems = items.filter((i) => i.batchId === batchId);
        const container = containerRef.current;
        if (!container || batchItems.length === 0) return;
        const minX = Math.min(...batchItems.map((i) => i.x));
        const minY = Math.min(...batchItems.map((i) => i.y));
        const maxX = Math.max(...batchItems.map((i) => i.x + i.width));
        const maxY = Math.max(...batchItems.map((i) => i.y + i.height));
        const bboxW = maxX - minX;
        const bboxH = maxY - minY;
        const rect = container.getBoundingClientRect();
        const pad = mobile ? 44 : 64;
        const scaleX = (rect.width - pad * 2) / bboxW;
        const scaleY = (rect.height - pad * 2) / bboxH;
        const nextZoom = Math.min(
          ZOOM_MAX,
          Math.max(ZOOM_MIN, Math.min(scaleX, scaleY, 1.15)),
        );
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        setZoom(nextZoom);
        setPan({
          x: rect.width / 2 - cx * nextZoom,
          y: rect.height / 2 - cy * nextZoom,
        });
      },
      [items, mobile],
    );

    const fitAll = useCallback(() => {
      const container = containerRef.current;
      if (!container || items.length === 0) {
        setZoom(1);
        setPan({ x: 0, y: 0 });
        return;
      }
      const minX = Math.min(...items.map((i) => i.x));
      const minY = Math.min(...items.map((i) => i.y));
      const maxX = Math.max(...items.map((i) => i.x + i.width));
      const maxY = Math.max(...items.map((i) => i.y + i.height));
      const bboxW = maxX - minX;
      const bboxH = maxY - minY;
      const rect = container.getBoundingClientRect();
      const pad = 32;
      const scaleX = (rect.width - pad * 2) / bboxW;
      const scaleY = (rect.height - pad * 2) / bboxH;
      const nextZoom = Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, Math.min(scaleX, scaleY)),
      );
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      setZoom(nextZoom);
      setPan({
        x: rect.width / 2 - cx * nextZoom,
        y: rect.height / 2 - cy * nextZoom,
      });
    }, [items]);

    const resetView = useCallback(() => {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }, []);

    const zoomIn = useCallback(() => {
      setZoom((z) => Math.min(ZOOM_MAX, z + zoomStep));
    }, [zoomStep]);

    const zoomOut = useCallback(() => {
      setZoom((z) => Math.max(ZOOM_MIN, z - zoomStep));
    }, [zoomStep]);

    const setZoomForTool = useCallback((toolId: string) => {
      if (toolId === "brush" || toolId === "focus-click") {
        setZoom((z) => Math.min(ZOOM_MAX, Math.max(z, 2.0)));
      } else if (toolId === "expand") {
        setZoom((z) => Math.max(ZOOM_MIN, Math.min(z, 0.75)));
      }
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        fitToItem,
        fitToBatch,
        fitAll,
        resetView,
        zoomIn,
        zoomOut,
        setZoomForTool,
      }),
      [fitToItem, fitToBatch, fitAll, resetView, zoomIn, zoomOut, setZoomForTool],
    );

    useEffect(() => {
      if (!brushRequest) return;
      onToolChange("select");
      setMaskMode("brush");
      setMaskStrokes([]);
      setMaskBoxes([]);
      activeStrokeRef.current = null;
      activeBoxRef.current = null;
      onSelect(brushRequest.itemId);
      window.requestAnimationFrame(() => fitToItem(brushRequest.itemId));
    }, [brushRequest, fitToItem, onSelect, onToolChange]);

    useEffect(() => {
      if (!focusClickRequest) return;
      onToolChange("select");
      onSelect(focusClickRequest.itemId);
      window.requestAnimationFrame(() => fitToItem(focusClickRequest.itemId));
    }, [focusClickRequest, fitToItem, onSelect, onToolChange]);

    function itemPointFromEvent(e: React.PointerEvent, item: CanvasItem) {
      const container = containerRef.current;
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom - item.x;
      const y = (e.clientY - rect.top - pan.y) / zoom - item.y;
      return {
        x: Math.max(0, Math.min(item.width, x)),
        y: Math.max(0, Math.min(item.height, y)),
      };
    }

    function allMaskPoints() {
      const points = maskStrokes.flat();
      for (const box of maskBoxes) {
        points.push(
          { x: box.x, y: box.y },
          { x: box.x + box.width, y: box.y + box.height },
        );
      }
      return points;
    }

    function buildMaskSelection(): CanvasMaskSelection | null {
      if (!brushRequest || !brushItem) return null;
      const points = allMaskPoints();
      if (points.length === 0) return null;
      const minX = Math.max(0, Math.min(...points.map((p) => p.x)));
      const minY = Math.max(0, Math.min(...points.map((p) => p.y)));
      const maxX = Math.min(
        brushItem.width,
        Math.max(...points.map((p) => p.x)),
      );
      const maxY = Math.min(
        brushItem.height,
        Math.max(...points.map((p) => p.y)),
      );
      const bbox = {
        x: Math.round(minX),
        y: Math.round(minY),
        width: Math.max(1, Math.round(maxX - minX)),
        height: Math.max(1, Math.round(maxY - minY)),
      };
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(brushItem.width));
      canvas.height = Math.max(1, Math.round(brushItem.height));
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "white";
      ctx.fillStyle = "white";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(
        16,
        Math.round(Math.min(brushItem.width, brushItem.height) * 0.08),
      );
      for (const stroke of maskStrokes) {
        if (stroke.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (const pt of stroke.slice(1)) ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      }
      for (const box of maskBoxes) {
        ctx.fillRect(box.x, box.y, box.width, box.height);
      }
      return {
        id: `${brushRequest.toolId}-${Date.now()}`,
        itemId: brushItem.id,
        toolId: brushRequest.toolId,
        mode: maskBoxes.length > 0 && maskStrokes.length === 0 ? "box" : "brush",
        maskDataUrl: canvas.toDataURL("image/png"),
        bbox,
        normalizedBbox: {
          x: bbox.x / brushItem.width,
          y: bbox.y / brushItem.height,
          width: bbox.width / brushItem.width,
          height: bbox.height / brushItem.height,
        },
      };
    }

    function finishBrushSelection() {
      const selection = buildMaskSelection();
      if (!selection) {
        hapticLight();
        return;
      }
      onBrushComplete?.(selection);
      setMaskStrokes([]);
      setMaskBoxes([]);
    }

    function onCanvasPointerDown(e: React.PointerEvent) {
      if (tool !== "pan" && !(mobile && e.pointerType === "touch")) {
        return;
      }
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
        onItemsChangeWithHistory(
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
      if (focusClickActive && focusItem && item.id === focusItem.id) {
        e.stopPropagation();
        e.preventDefault();
        const pt = itemPointFromEvent(e, item);
        if (!pt || readOnly) return;
        onFocusImageClick?.(item, {
          x: pt.x / item.width,
          y: pt.y / item.height,
        });
        hapticLight();
        return;
      }
      if (brushActive) return;
      if (tool !== "select") return;
      e.stopPropagation();
      onSelect(item.id);
      hapticLight();

      if (mobile && !readOnly) {
        longPressRef.current = setTimeout(() => {
          onSetContextMenu({ item, x: e.clientX, y: e.clientY });
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

    function onMaskPointerDown(e: React.PointerEvent, item: CanvasItem) {
      if (!brushActive) return;
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const pt = itemPointFromEvent(e, item);
      if (!pt) return;
      if (maskMode === "box") {
        activeBoxRef.current = pt;
        setMaskBoxes((prev) => [...prev, { x: pt.x, y: pt.y, width: 1, height: 1 }]);
        return;
      }
      activeStrokeRef.current = [pt];
      setMaskStrokes((prev) => [...prev, [pt]]);
    }

    function onMaskPointerMove(e: React.PointerEvent, item: CanvasItem) {
      if (!brushActive) return;
      const pt = itemPointFromEvent(e, item);
      if (!pt) return;
      if (maskMode === "box" && activeBoxRef.current) {
        const start = activeBoxRef.current;
        const box = {
          x: Math.min(start.x, pt.x),
          y: Math.min(start.y, pt.y),
          width: Math.abs(pt.x - start.x),
          height: Math.abs(pt.y - start.y),
        };
        setMaskBoxes((prev) => [...prev.slice(0, -1), box]);
        return;
      }
      if (!activeStrokeRef.current) return;
      activeStrokeRef.current = [...activeStrokeRef.current, pt];
      setMaskStrokes((prev) => [
        ...prev.slice(0, -1),
        activeStrokeRef.current ?? [],
      ]);
    }

    function endMaskPointer() {
      activeStrokeRef.current = null;
      activeBoxRef.current = null;
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
          setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + delta)));
          return;
        }
        e.preventDefault();
        setPan((p) => ({
          x: p.x - e.deltaX,
          y: p.y - e.deltaY,
        }));
      }
      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    }, [touchUi, wheelZoomStep]);

    const zoomRef = useRef(zoom);
    const panRef = useRef(pan);
    useEffect(() => {
      zoomRef.current = zoom;
    }, [zoom]);
    useEffect(() => {
      panRef.current = pan;
    }, [pan]);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      let pinchBase: {
        dist: number;
        zoom: number;
        pan: { x: number; y: number };
        cx: number;
        cy: number;
      } | null = null;

      function dist(a: Touch, b: Touch) {
        const dx = a.clientX - b.clientX;
        const dy = a.clientY - b.clientY;
        return Math.hypot(dx, dy);
      }

      function center(a: Touch, b: Touch) {
        return {
          x: (a.clientX + b.clientX) / 2,
          y: (a.clientY + b.clientY) / 2,
        };
      }

      function onTouchStart(e: TouchEvent) {
        if (e.touches.length !== 2) return;
        const rect = el!.getBoundingClientRect();
        const c = center(e.touches[0], e.touches[1]);
        pinchBase = {
          dist: dist(e.touches[0], e.touches[1]),
          zoom: zoomRef.current,
          pan: { x: panRef.current.x, y: panRef.current.y },
          cx: c.x - rect.left,
          cy: c.y - rect.top,
        };
        dragRef.current = null;
        panStart.current = null;
        if (longPressRef.current) {
          clearTimeout(longPressRef.current);
          longPressRef.current = null;
        }
      }

      function onTouchMove(e: TouchEvent) {
        if (!pinchBase || e.touches.length !== 2) return;
        e.preventDefault();
        const d = dist(e.touches[0], e.touches[1]);
        const ratio = d / pinchBase.dist;
        const nextZoom = Math.min(
          ZOOM_MAX,
          Math.max(ZOOM_MIN, pinchBase.zoom * ratio),
        );
        const k = nextZoom / pinchBase.zoom;
        setZoom(nextZoom);
        setPan({
          x: pinchBase.cx - (pinchBase.cx - pinchBase.pan.x) * k,
          y: pinchBase.cy - (pinchBase.cy - pinchBase.pan.y) * k,
        });
      }

      function onTouchEnd(e: TouchEvent) {
        if (e.touches.length < 2) pinchBase = null;
      }

      el.addEventListener("touchstart", onTouchStart, { passive: false });
      el.addEventListener("touchmove", onTouchMove, { passive: false });
      el.addEventListener("touchend", onTouchEnd);
      el.addEventListener("touchcancel", onTouchEnd);
      return () => {
        el.removeEventListener("touchstart", onTouchStart);
        el.removeEventListener("touchmove", onTouchMove);
        el.removeEventListener("touchend", onTouchEnd);
        el.removeEventListener("touchcancel", onTouchEnd);
      };
    }, []);

    return (
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

        {brushActive && brushRequest ? (
          <div className="absolute left-2 right-2 top-2 z-30 rounded-2xl border border-purple-400/30 bg-black/80 p-2 text-xs text-zinc-200 shadow-xl backdrop-blur">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-purple-200">
                {brushRequest.toolName}：圈选要处理的区域
              </span>
              <button
                type="button"
                onClick={() => setMaskMode("brush")}
                className={`rounded-full px-2.5 py-1 ${
                  maskMode === "brush"
                    ? "bg-purple-500 text-white"
                    : "bg-white/10 text-zinc-300"
                }`}
              >
                画笔
              </button>
              <button
                type="button"
                onClick={() => setMaskMode("box")}
                className={`rounded-full px-2.5 py-1 ${
                  maskMode === "box"
                    ? "bg-purple-500 text-white"
                    : "bg-white/10 text-zinc-300"
                }`}
              >
                框选
              </button>
              <button
                type="button"
                onClick={() => {
                  setMaskStrokes((prev) => prev.slice(0, -1));
                  setMaskBoxes((prev) => prev.slice(0, -1));
                }}
                className="rounded-full bg-white/10 px-2.5 py-1 text-zinc-300"
              >
                撤销
              </button>
              <button
                type="button"
                onClick={finishBrushSelection}
                className="ml-auto rounded-full bg-purple-500 px-3 py-1 font-medium text-white"
              >
                完成圈选
              </button>
              <button
                type="button"
                onClick={onBrushCancel}
                className="rounded-full bg-white/10 px-2.5 py-1 text-zinc-300"
              >
                取消
              </button>
            </div>
            <p className="mt-1 text-[10px] text-zinc-500">
              移动端可直接用手指大致圈选，系统会同时提交 mask 与区域位置。
            </p>
          </div>
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
            <div className="flex h-[min(60vh,480px)] w-[min(90vw,720px)] flex-col items-center justify-center gap-4 p-8">
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
            <>
              {!isRefineMode &&
                batchSections.map((section) => {
                  const parentNum = section.parentBatchId
                    ? batchDisplayIndex(items, section.parentBatchId)
                    : null;
                  return (
                    <div
                      key={section.id}
                      role="button"
                      tabIndex={0}
                      data-testid={`canvas-batch-section-${section.id}`}
                      className="absolute cursor-pointer rounded-3xl border border-white/10 bg-black/15 text-left transition hover:border-white/20"
                      style={{
                        left: section.x,
                        top: section.y,
                        width: section.width,
                        height: section.height,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        fitToBatch(section.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          fitToBatch(section.id);
                        }
                      }}
                    >
                      <div className="pointer-events-none flex items-center justify-between gap-4 px-4 py-3">
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
                              data-testid={`canvas-batch-parent-${section.id}`}
                              className="pointer-events-auto mt-1 truncate text-[11px] text-orange-400/90 underline-offset-2 hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
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
                    </div>
                  );
                })}
              {items.map((item) => {
                if (isRefineMode && item.id !== refineItemId) {
                  return null;
                }
                const batchItems = items.filter(
                  (i) => i.batchId === item.batchId,
                );
                return (
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
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onSetLightbox({
                        items:
                          batchItems.length > 0 ? batchItems : [item],
                        index:
                          batchItems.findIndex((i) => i.id === item.id) ||
                          0,
                      });
                    }}
                    className={`group relative overflow-hidden rounded-lg bg-zinc-900 text-left transition ${
                      focusClickActive && focusItem?.id === item.id
                        ? "cursor-crosshair"
                        : tool === "select"
                          ? "cursor-grab active:cursor-grabbing"
                          : ""
                    } ${
                      selectedId === item.id
                        ? isRefineMode
                          ? "ring-1 ring-orange-400/50"
                          : "border border-orange-500/80 ring-1 ring-orange-500/30"
                        : isRefineMode
                          ? "hover:ring-1 hover:ring-white/20"
                          : "border border-white/10 hover:border-white/25"
                    } ${pulseId === item.id ? "animate-pulse ring-4 ring-orange-400/50" : ""}`}
                  >
                    <ImageActionBar
                      item={item}
                      selected={selectedId === item.id}
                      onPreview={() => {
                        onSetLightbox({
                          items:
                            batchItems.length > 0 ? batchItems : [item],
                          index:
                            batchItems.findIndex((i) => i.id === item.id) ||
                            0,
                        });
                      }}
                      onRefine={() => {
                        onEnterRefineMode(item.id);
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
                        className="w-full object-cover"
                        style={{ height: item.height }}
                      />
                    ) : (
                      <img
                        src={assetUrl(item.url)}
                        alt=""
                        loading="lazy"
                        className="pointer-events-none w-full bg-zinc-800 object-cover transition-opacity duration-300"
                        style={{ height: item.height, opacity: 0 }}
                        draggable={false}
                        onLoad={(e) => {
                          (e.target as HTMLImageElement).style.opacity = "1";
                        }}
                      />
                    )}
                    {focusClickActive &&
                    focusClickRequest &&
                    focusItem?.id === item.id &&
                    focusClickRequest.markers.length > 0 ? (
                      <svg
                        viewBox={`0 0 ${item.width} ${item.height}`}
                        className="pointer-events-none absolute inset-0 z-10"
                        aria-hidden
                      >
                        {focusClickRequest.markers.map((m, i) => (
                          <g key={`focus-${i}-${m.x}-${m.y}`}>
                            <circle
                              cx={m.x * item.width}
                              cy={m.y * item.height}
                              r={10}
                              fill="rgba(168,85,247,0.35)"
                              stroke="rgb(216,180,254)"
                              strokeWidth={2}
                            />
                            <circle
                              cx={m.x * item.width}
                              cy={m.y * item.height}
                              r={3}
                              fill="white"
                            />
                          </g>
                        ))}
                      </svg>
                    ) : null}
                    {brushActive && brushItem?.id === item.id ? (
                      <svg
                        viewBox={`0 0 ${item.width} ${item.height}`}
                        className="absolute inset-0 z-10 touch-none bg-purple-500/10"
                        onPointerDown={(e) => onMaskPointerDown(e, item)}
                        onPointerMove={(e) => onMaskPointerMove(e, item)}
                        onPointerUp={endMaskPointer}
                        onPointerCancel={endMaskPointer}
                        onPointerLeave={endMaskPointer}
                      >
                        {maskBoxes.map((box, i) => (
                          <rect
                            key={`box-${i}`}
                            x={box.x}
                            y={box.y}
                            width={box.width}
                            height={box.height}
                            fill="rgba(168,85,247,0.28)"
                            stroke="rgb(216,180,254)"
                            strokeWidth={2}
                            vectorEffect="non-scaling-stroke"
                          />
                        ))}
                        {maskStrokes.map((stroke, i) => (
                          <polyline
                            key={`stroke-${i}`}
                            points={stroke
                              .map((p) => `${p.x},${p.y}`)
                              .join(" ")}
                            fill="none"
                            stroke="rgb(216,180,254)"
                            strokeWidth={18}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity={0.85}
                            vectorEffect="non-scaling-stroke"
                          />
                        ))}
                      </svg>
                    ) : null}
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between gap-2 text-[10px] text-zinc-500">
          <div className="pointer-events-auto flex items-center gap-2 rounded-lg bg-black/60 px-2 py-1 backdrop-blur">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - 0.1))}
              className="text-zinc-400 hover:text-white"
              title="缩小"
            >
              <Minus className="size-3" />
            </button>
            <input
              type="range"
              min={ZOOM_MIN * 100}
              max={ZOOM_MAX * 100}
              step={5}
              value={Math.round(zoom * 100)}
              onChange={(e) => setZoom(Number(e.target.value) / 100)}
              title="缩放比例"
              className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-zinc-600 [&::-webkit-slider-thumb]:size-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-400"
            />
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + 0.1))}
              className="text-zinc-400 hover:text-white"
              title="放大"
            >
              <Plus className="size-3" />
            </button>
            <span className="min-w-[3ch] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={resetView}
              className="rounded px-1 text-zinc-400 hover:bg-white/10 hover:text-white"
              title="重置为 100%"
            >
              1:1
            </button>
            <button
              type="button"
              onClick={() => {
                if (refineItemId) fitToItem(refineItemId);
              }}
              className="rounded px-1 text-zinc-400 hover:bg-white/10 hover:text-white"
              title="适应画布"
            >
              适应
            </button>
            {canvasSelectionHint(mobile, Boolean(selectedId))}
          </div>
          {statusChip ? (
            <div className="pointer-events-auto">{statusChip}</div>
          ) : null}
        </div>

        {selectionToolbar}
      </div>
    );
  },
);
