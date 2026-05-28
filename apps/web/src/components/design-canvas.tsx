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
} from "@/lib/canvas-tools";
import { CanvasToolbar } from "@/components/canvas-toolbar";
import { CanvasJobOverlay } from "@/components/canvas-job-overlay";
import { CanvasContextMenu } from "@/components/canvas-context-menu";
import { MOBILE_BREAKPOINT } from "@/lib/breakpoints";
import { canvasSelectionHint } from "@/lib/mobile-labels";
import { hapticLight } from "@/lib/haptics";
import { useIsMobile } from "@/hooks/use-is-mobile";

/** 画布缩放范围：放宽到 6 倍，便于查看出图细节；下限 0.2 便于全图概览 */
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 6;

export interface DesignCanvasHandle {
  fitToItem: (itemId: string) => void;
  pulseItem: (itemId: string) => void;
  /** 自动适配所有 items 的 bbox，让画布默认就把全部图片铺满可视区 ~80% */
  fitAll: () => void;
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
  /**
   * 画布选中图片后浮出的 AI 工具栏（slot）。
   * - PC：建议绝对定位画布右上角（vertical layout）
   * - Mobile：建议浮在画布顶部 banner 区（horizontal layout）
   * 由父组件根据 mobile 状态自行决定布局。
   */
  selectionToolbar?: ReactNode;
  /** 画布右下角状态 chip（如 Provider 状态），与 zoom 同行 */
  statusChip?: ReactNode;
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
      selectionToolbar = null,
      statusChip = null,
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
    const [maskMode, setMaskMode] = useState<"brush" | "box">("brush");
    const [maskStrokes, setMaskStrokes] = useState<Array<Array<{ x: number; y: number }>>>([]);
    const [maskBoxes, setMaskBoxes] = useState<
      Array<{ x: number; y: number; width: number; height: number }>
    >([]);
    const activeStrokeRef = useRef<Array<{ x: number; y: number }> | null>(null);
    const activeBoxRef = useRef<{ x: number; y: number } | null>(null);
    const mobile = useIsMobile(MOBILE_BREAKPOINT);
    const touchUi = mobile;
    const zoomStep = touchUi ? 0.28 : 0.15;
    const wheelZoomStep = touchUi ? 0.22 : 0.08;
    const panGain = touchUi ? 1.35 : 1;
    const brushItem =
      brushRequest ? items.find((item) => item.id === brushRequest.itemId) : null;
    const brushActive = Boolean(brushRequest && brushItem);
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
      const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(scaleX, scaleY)));
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
      const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(scaleX, scaleY)));
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      setZoom(nextZoom);
      setPan({
        x: rect.width / 2 - cx * nextZoom,
        y: rect.height / 2 - cy * nextZoom,
      });
    }, [items]);

    useImperativeHandle(ref, () => ({ fitToItem, pulseItem, fitAll }), [
      fitToItem,
      pulseItem,
      fitAll,
    ]);

    useEffect(() => {
      if (!brushRequest) return;
      setTool("select");
      setMaskMode("brush");
      setMaskStrokes([]);
      setMaskBoxes([]);
      activeStrokeRef.current = null;
      activeBoxRef.current = null;
      onSelect(brushRequest.itemId);
      window.requestAnimationFrame(() => fitToItem(brushRequest.itemId));
    }, [brushRequest, fitToItem, onSelect]);

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
      const maxX = Math.min(brushItem.width, Math.max(...points.map((p) => p.x)));
      const maxY = Math.min(brushItem.height, Math.max(...points.map((p) => p.y)));
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
      ctx.lineWidth = Math.max(16, Math.round(Math.min(brushItem.width, brushItem.height) * 0.08));
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

    const handleTool = useCallback(
      (id: CanvasToolId) => {
        if (id === "zoom-in") setZoom((z) => Math.min(ZOOM_MAX, z + zoomStep));
        else if (id === "zoom-out")
          setZoom((z) => Math.max(ZOOM_MIN, z - zoomStep));
        else if (id === "fit") {
          fitAll();
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
      [
        onUpload,
        onDownload,
        onDeleteSelected,
        selectedId,
        readOnly,
        zoomStep,
        fitAll,
      ],
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
      if (brushActive) return;
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
        }
      }
      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    }, [touchUi, wheelZoomStep]);

    /**
     * 用 ref 保存最新 zoom/pan，避免 useEffect 依赖触发 cleanup + re-bind
     * 导致 pinchBase 闭包变量被重置为 null（这是之前移动端双指缩放失效的根因）。
     */
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
        /**
         * 双指开始：强制中断单指 drag/pan，释放可能存在的 pointer capture，
         * 避免「第一指还在拖图片」导致 pinch 被错认成 drag。
         */
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
      // 依赖空：只绑定一次，避免 zoom/pan 变化 cleanup 把 pinchBase 重置
    }, []);

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
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      fitToItem(item.id);
                    }}
                    className={`relative overflow-hidden rounded-xl border-2 bg-zinc-900 text-left shadow-lg transition ${
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
                            points={stroke.map((p) => `${p.x},${p.y}`).join(" ")}
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
                ))
              )}
            </div>

            <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between gap-2 text-[10px] text-zinc-500">
              <div className="pointer-events-auto rounded-lg bg-black/60 px-2 py-1 backdrop-blur">
                {Math.round(zoom * 100)}%
                {canvasSelectionHint(mobile, Boolean(selectedId))}
              </div>
              {statusChip ? (
                <div className="pointer-events-auto">{statusChip}</div>
              ) : null}
            </div>

            {selectionToolbar}
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
