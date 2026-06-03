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
import { CanvasJobOverlay } from "@/components/canvas-job-overlay";
import { RefineCompareView } from "@/components/refine-compare-view";
import { RefineFilmstrip } from "@/components/refine-filmstrip";
import { hapticLight } from "@/lib/haptics";
import { canvasSelectionHint } from "@/lib/mobile-labels";
import { focusIndexLabel } from "@/lib/focus-index-labels";
import { useMaskBrush } from "@/hooks/use-mask-brush";
import { MaskBrushToolbar } from "@/components/mask-brush-toolbar";
import { ExpandFrameOverlay } from "@/components/expand-frame-overlay";
import type { ExpandAspectPreset } from "@/lib/expand-frame";
import type { ExpandFramePadding } from "@/lib/expand-frame";
import { Minus, Plus, Lock, Unlock } from "lucide-react";

const TRANSPARENT_BG_STYLE = {
  backgroundColor: "#1a1a1a",
  backgroundImage: `
    linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
    linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
    linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)
  `,
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
} as const;

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 6;
const DRAG_THRESHOLD = 4;
const SNAP_GRID = 20;
const MOMENTUM_FRICTION = 0.92;
const MOMENTUM_THRESHOLD = 0.5;

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
  refineRootItemId?: string | null;
  refineChain?: CanvasItem[];
  onRefineTargetSelect?: (itemId: string) => void;
  compareMode?: boolean;
  comparePair?: { before: CanvasItem; after: CanvasItem } | null;
  onCompareModeChange?: (on: boolean) => void;
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
  onRerun: (item: CanvasItem) => void;
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
  expandRequest?: {
    key: number;
    itemId: string;
    toolName: string;
    aspectPreset?: ExpandAspectPreset;
  } | null;
  onExpandComplete?: (
    padding: ExpandFramePadding,
    aspect: ExpandAspectPreset,
  ) => void;
  onExpandCancel?: () => void;
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
  onCancelJob?: () => void;
  jobElapsedMs?: number;
  queueAhead?: number | null;
  mobile: boolean;
}

function snapToGrid(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
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
      refineRootItemId = null,
      refineChain = [],
      onRefineTargetSelect,
      compareMode = false,
      comparePair = null,
      onCompareModeChange,
      onExitRefineMode,
      onSetLightbox,
      onSetContextMenu,
      onJumpToParentBatch,
      onDeleteSelected,
      onRerun,
      tool,
      onToolChange,
      gridOn,
      brushRequest = null,
      onBrushComplete,
      onBrushCancel,
      expandRequest = null,
      onExpandComplete,
      onExpandCancel,
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
      onCancelJob,
      jobElapsedMs,
      queueAhead,
      mobile,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const activeStrokeRef = useRef<Array<{ x: number; y: number }> | null>(
      null,
    );
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
    const pendingDragRef = useRef<{
      id: string;
      startX: number;
      startY: number;
      originX: number;
      originY: number;
    } | null>(null);
    const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const momentumRef = useRef<{ vx: number; vy: number; raf: number } | null>(null);

    const touchUi = mobile;
    const zoomStep = touchUi ? 0.28 : 0.15;
    const wheelZoomStep = touchUi ? 0.22 : 0.08;
    const panGain = touchUi ? 1.35 : 1;

    const brushItem = brushRequest
      ? items.find((item) => item.id === brushRequest.itemId)
      : null;
    const brushActive = Boolean(brushRequest && brushItem);
    const expandItem = expandRequest
      ? items.find((item) => item.id === expandRequest.itemId)
      : null;
    const expandActive = Boolean(expandRequest && expandItem);
    const maskBrush = useMaskBrush(
      brushItem?.width ?? 512,
      brushItem?.height ?? 512,
    );
    const focusItem = focusClickRequest
      ? items.find((item) => item.id === focusClickRequest.itemId)
      : null;
    const focusClickActive = Boolean(focusClickRequest && focusItem);

    const showJobOverlay =
      Boolean(jobStreamStatus) &&
      jobStreamStatus !== "succeeded" &&
      jobStreamStatus !== "failed";

    const zoomAtPoint = useCallback(
      (newZoom: number, cursorX: number, cursorY: number) => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const cx = cursorX - rect.left;
        const cy = cursorY - rect.top;
        setZoom((oldZoom) => {
          const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, newZoom));
          const ratio = clamped / oldZoom;
          setPan((p) => ({
            x: cx - (cx - p.x) * ratio,
            y: cy - (cy - p.y) * ratio,
          }));
          return clamped;
        });
      },
      [],
    );

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
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      zoomAtPoint(zoom + zoomStep, rect.left + rect.width / 2, rect.top + rect.height / 2);
    }, [zoom, zoomStep, zoomAtPoint]);

    const zoomOut = useCallback(() => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      zoomAtPoint(zoom - zoomStep, rect.left + rect.width / 2, rect.top + rect.height / 2);
    }, [zoom, zoomStep, zoomAtPoint]);

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
      maskBrush.reset();
      activeStrokeRef.current = null;
      onSelect(brushRequest.itemId);
      window.requestAnimationFrame(() => fitToItem(brushRequest.itemId));
    }, [brushRequest?.key, fitToItem, onSelect, onToolChange]);

    useEffect(() => {
      if (!expandRequest) return;
      onToolChange("select");
      onSelect(expandRequest.itemId);
      window.requestAnimationFrame(() => fitToItem(expandRequest.itemId));
    }, [expandRequest?.key, fitToItem, onSelect, onToolChange]);

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

    function finishBrushSelection() {
      if (!brushRequest || !brushItem) return;
      const selection = maskBrush.buildMaskSelection(brushRequest, brushItem);
      if (!selection) {
        hapticLight();
        return;
      }
      onBrushComplete?.(selection);
      maskBrush.reset();
    }

    function startMomentum(vx: number, vy: number) {
      if (momentumRef.current) {
        cancelAnimationFrame(momentumRef.current.raf);
      }
      function tick() {
        const m = momentumRef.current;
        if (!m) return;
        m.vx *= MOMENTUM_FRICTION;
        m.vy *= MOMENTUM_FRICTION;
        if (Math.abs(m.vx) < MOMENTUM_THRESHOLD && Math.abs(m.vy) < MOMENTUM_THRESHOLD) {
          momentumRef.current = null;
          return;
        }
        setPan((p) => ({ x: p.x + m.vx, y: p.y + m.vy }));
        m.raf = requestAnimationFrame(tick);
      }
      momentumRef.current = { vx, vy, raf: requestAnimationFrame(tick) };
    }

    function stopMomentum() {
      if (momentumRef.current) {
        cancelAnimationFrame(momentumRef.current.raf);
        momentumRef.current = null;
      }
    }

    const lastPanVelocity = useRef({ vx: 0, vy: 0 });

    function onCanvasPointerDown(e: React.PointerEvent) {
      const isPanTrigger =
        tool === "pan" ||
        e.button === 1 ||
        e.button === 2 ||
        (mobile && e.pointerType === "touch");

      if (!isPanTrigger) return;

      e.preventDefault();
      stopMomentum();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        px: pan.x,
        py: pan.y,
      };
      lastPanVelocity.current = { vx: 0, vy: 0 };
    }

    function onCanvasPointerMove(e: React.PointerEvent) {
      if (pendingDragRef.current && tool === "select") {
        const pd = pendingDragRef.current;
        const dx = e.clientX - pd.startX;
        const dy = e.clientY - pd.startY;
        if (Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
          const item = items.find((i) => i.id === pd.id);
          if (item && item.locked) {
            pendingDragRef.current = null;
            return;
          }
          dragRef.current = pendingDragRef.current;
          pendingDragRef.current = null;
        }
      }

      if (!readOnly && dragRef.current && tool === "select") {
        const d = dragRef.current;
        const dx = (e.clientX - d.startX) / zoom;
        const dy = (e.clientY - d.startY) / zoom;
        const newX = snapToGrid(d.originX + dx, SNAP_GRID);
        const newY = snapToGrid(d.originY + dy, SNAP_GRID);
        onItemsChangeWithHistory(
          items.map((it) =>
            it.id === d.id ? { ...it, x: newX, y: newY } : it,
          ),
        );
        return;
      }

      if (panStart.current) {
        const newPx = panStart.current.px + (e.clientX - panStart.current.x) * panGain;
        const newPy = panStart.current.py + (e.clientY - panStart.current.y) * panGain;
        lastPanVelocity.current = {
          vx: (newPx - pan.x) * 0.3,
          vy: (newPy - pan.y) * 0.3,
        };
        setPan({ x: newPx, y: newPy });
      }
    }

    function endPointer() {
      if (dragRef.current) {
        const item = items.find((i) => i.id === dragRef.current?.id);
        if (item && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const itemLeft = item.x * zoom + pan.x;
          const itemRight = (item.x + item.width) * zoom + pan.x;
          const itemTop = item.y * zoom + pan.y;
          const itemBottom = (item.y + item.height) * zoom + pan.y;
          const margin = 50;
          const isOutside =
            itemRight < margin ||
            itemLeft > rect.width - margin ||
            itemBottom < margin ||
            itemTop > rect.height - margin;
          if (isOutside) {
            fitToItem(item.id);
          }
        }
      }

      if (panStart.current) {
        const v = lastPanVelocity.current;
        if (Math.abs(v.vx) > MOMENTUM_THRESHOLD || Math.abs(v.vy) > MOMENTUM_THRESHOLD) {
          startMomentum(v.vx, v.vy);
        }
      }

      panStart.current = null;
      dragRef.current = null;
      pendingDragRef.current = null;
      if (longPressRef.current) {
        clearTimeout(longPressRef.current);
        longPressRef.current = null;
      }
    }

    function onItemPointerDown(e: React.PointerEvent, item: CanvasItem) {
      if (e.button === 1 || e.button === 2) {
        e.stopPropagation();
        stopMomentum();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        panStart.current = {
          x: e.clientX,
          y: e.clientY,
          px: pan.x,
          py: pan.y,
        };
        lastPanVelocity.current = { vx: 0, vy: 0 };
        return;
      }

      if (focusClickActive && focusItem && item.id === focusItem.id) {
        return;
      }
      if (brushActive || expandActive) return;
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
      if (item.locked) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      pendingDragRef.current = {
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
      maskBrush.pushHistory();
      activeStrokeRef.current = [pt];
      maskBrush.appendStrokePoint(pt);
    }

    function onMaskPointerMove(e: React.PointerEvent, item: CanvasItem) {
      if (!brushActive) return;
      const pt = itemPointFromEvent(e, item);
      if (!pt || !activeStrokeRef.current) return;
      activeStrokeRef.current = [...activeStrokeRef.current, pt];
      maskBrush.updateActiveStroke(activeStrokeRef.current);
    }

    function endMaskPointer() {
      activeStrokeRef.current = null;
    }

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      function onWheel(e: WheelEvent) {
        const pinchZoom = e.ctrlKey || e.metaKey;
        const touchPinch = touchUi && !pinchZoom;
        if (pinchZoom || touchPinch) {
          e.preventDefault();
          const factor = e.deltaY > 0 ? 1 - wheelZoomStep : 1 + wheelZoomStep;
          const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomRef.current * factor));
          zoomAtPoint(newZoom, e.clientX, e.clientY);
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
    }, [touchUi, wheelZoomStep, zoomAtPoint]);

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
        return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
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
        pendingDragRef.current = null;
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

    useEffect(() => {
      return () => stopMomentum();
    }, []);

    function toggleLock(itemId: string) {
      onItemsChangeWithHistory(
        items.map((it) =>
          it.id === itemId ? { ...it, locked: !it.locked } : it,
        ),
      );
    }

    const minimapScale = 0.06;
    const visibleItems =
      refineItemId ? items.filter((i) => i.id === refineItemId) : [];
    const minimapBounds = visibleItems.length > 0
      ? {
          minX: Math.min(...visibleItems.map((i) => i.x)),
          minY: Math.min(...visibleItems.map((i) => i.y)),
          maxX: Math.max(...visibleItems.map((i) => i.x + i.width)),
          maxY: Math.max(...visibleItems.map((i) => i.y + i.height)),
        }
      : null;

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
        onContextMenu={(e) => e.preventDefault()}
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

        {brushActive && brushRequest ? (
          <MaskBrushToolbar
            title={`${brushRequest.toolName}：涂抹要处理的区域`}
            brushSize={maskBrush.brushSize}
            brushSizeMin={maskBrush.brushSizeMin}
            brushSizeMax={maskBrush.brushSizeMax}
            onBrushSizeChange={maskBrush.setBrushSize}
            canUndo={maskBrush.canUndo}
            canRedo={maskBrush.canRedo}
            onUndo={maskBrush.undo}
            onRedo={maskBrush.redo}
            onClear={maskBrush.clearAll}
            onComplete={finishBrushSelection}
            onCancel={() => {
              maskBrush.reset();
              onBrushCancel?.();
            }}
            completeLabel={
              brushRequest.toolId === "inpaint" ? "下一步：填写提示词" : "完成圈选"
            }
          />
        ) : null}

        {gridOn ? (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundColor: "#0d0d0d",
              backgroundImage: `
                linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
              `,
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
            <div
              className="h-[min(60vh,480px)] w-[min(90vw,720px)]"
              aria-label="画布"
            />
          ) : (
            <>
              {visibleItems.map((item) => {
                const batchItems = visibleItems;
                const isLocked = item.locked !== false;
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    data-testid={`canvas-item-${item.id}`}
                    style={{
                      position: "absolute",
                      left: item.x,
                      top: item.y,
                      width: item.width,
                    }}
                    onPointerDown={(e) => onItemPointerDown(e, item)}
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
                      }
                    }}
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
                        : isLocked
                          ? "cursor-default"
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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLock(item.id);
                      }}
                      className={`absolute top-1.5 right-1.5 z-30 flex size-6 items-center justify-center rounded-md transition-opacity ${
                        isLocked
                          ? "bg-amber-500/20 text-amber-400 opacity-60 group-hover:opacity-100"
                          : "bg-white/10 text-zinc-400 opacity-0 group-hover:opacity-100"
                      }`}
                      title={isLocked ? "解锁位置（允许拖拽）" : "锁定位置（禁止拖拽）"}
                    >
                      {isLocked ? (
                        <Lock className="size-3" />
                      ) : (
                        <Unlock className="size-3" />
                      )}
                    </button>
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
                        className="pointer-events-none w-full object-contain transition-opacity duration-300"
                        style={{
                          height: item.height,
                          opacity: 0,
                          ...(item.url.toLowerCase().includes(".png") ||
                          item.generationParams?.toolType === "cutout"
                            ? TRANSPARENT_BG_STYLE
                            : { backgroundColor: "#27272a" }),
                        }}
                        draggable={false}
                        onLoad={(e) => {
                          (e.target as HTMLImageElement).style.opacity = "1";
                        }}
                      />
                    )}
                    {isRefineMode && selectedId === item.id && (
                      <>
                        <div
                          className="absolute top-0 left-0 z-20 h-2 w-2 cursor-se-resize border border-white/50 bg-white/30 transition-transform hover:scale-150"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const startX = e.clientX;
                            const startY = e.clientY;
                            const startW = item.width;
                            const startH = item.height;
                            const startXPos = item.x;
                            const startYPos = item.y;
                            const handleResize = (moveE: MouseEvent) => {
                              const dx = moveE.clientX - startX;
                              const dy = moveE.clientY - startY;
                              const newW = Math.max(100, startW - dx);
                              const newH = Math.max(100, startH - dy);
                              const newX = startXPos + (startW - newW);
                              const newY = startYPos + (startH - newH);
                              onItemsChangeWithHistory(
                                items.map((it) =>
                                  it.id === item.id
                                    ? { ...it, width: newW, height: newH, x: newX, y: newY }
                                    : it,
                                ),
                              );
                            };
                            const stopResize = () => {
                              window.removeEventListener("mousemove", handleResize);
                              window.removeEventListener("mouseup", stopResize);
                            };
                            window.addEventListener("mousemove", handleResize);
                            window.addEventListener("mouseup", stopResize);
                          }}
                          title="左上角调整大小"
                        />
                        <div
                          className="absolute top-0 right-0 z-20 h-2 w-2 cursor-sw-resize border border-white/50 bg-white/30 transition-transform hover:scale-150"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const startX = e.clientX;
                            const startY = e.clientY;
                            const startW = item.width;
                            const startH = item.height;
                            const startYPos = item.y;
                            const handleResize = (moveE: MouseEvent) => {
                              const dx = moveE.clientX - startX;
                              const dy = moveE.clientY - startY;
                              const newW = Math.max(100, startW + dx);
                              const newH = Math.max(100, startH - dy);
                              const newY = startYPos + (startH - newH);
                              onItemsChangeWithHistory(
                                items.map((it) =>
                                  it.id === item.id
                                    ? { ...it, width: newW, height: newH, y: newY }
                                    : it,
                                ),
                              );
                            };
                            const stopResize = () => {
                              window.removeEventListener("mousemove", handleResize);
                              window.removeEventListener("mouseup", stopResize);
                            };
                            window.addEventListener("mousemove", handleResize);
                            window.addEventListener("mouseup", stopResize);
                          }}
                          title="右上角调整大小"
                        />
                        <div
                          className="absolute bottom-0 left-0 z-20 h-2 w-2 cursor-ne-resize border border-white/50 bg-white/30 transition-transform hover:scale-150"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const startX = e.clientX;
                            const startY = e.clientY;
                            const startW = item.width;
                            const startH = item.height;
                            const startXPos = item.x;
                            const handleResize = (moveE: MouseEvent) => {
                              const dx = moveE.clientX - startX;
                              const dy = moveE.clientY - startY;
                              const newW = Math.max(100, startW - dx);
                              const newH = Math.max(100, startH + dy);
                              const newX = startXPos + (startW - newW);
                              onItemsChangeWithHistory(
                                items.map((it) =>
                                  it.id === item.id
                                    ? { ...it, width: newW, height: newH, x: newX }
                                    : it,
                                ),
                              );
                            };
                            const stopResize = () => {
                              window.removeEventListener("mousemove", handleResize);
                              window.removeEventListener("mouseup", stopResize);
                            };
                            window.addEventListener("mousemove", handleResize);
                            window.addEventListener("mouseup", stopResize);
                          }}
                          title="左下角调整大小"
                        />
                        <div
                          className="absolute bottom-0 right-0 z-20 h-2 w-2 cursor-nwse-resize border border-white/50 bg-white/30 transition-transform hover:scale-150"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const startX = e.clientX;
                            const startY = e.clientY;
                            const startW = item.width;
                            const startH = item.height;
                            const handleResize = (moveE: MouseEvent) => {
                              const dx = moveE.clientX - startX;
                              const dy = moveE.clientY - startY;
                              const newW = Math.max(100, startW + dx);
                              const newH = Math.max(100, startH + dy);
                              onItemsChangeWithHistory(
                                items.map((it) =>
                                  it.id === item.id
                                    ? { ...it, width: newW, height: newH }
                                    : it,
                                ),
                              );
                            };
                            const stopResize = () => {
                              window.removeEventListener("mousemove", handleResize);
                              window.removeEventListener("mouseup", stopResize);
                            };
                            window.addEventListener("mousemove", handleResize);
                            window.addEventListener("mouseup", stopResize);
                          }}
                          title="右下角调整大小"
                        />
                      </>
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
                        {focusClickRequest.markers.map((m, i) => {
                          const cx = m.x * item.width;
                          const cy = m.y * item.height;
                          const label = focusIndexLabel(i);
                          return (
                            <g key={`focus-${i}-${m.x}-${m.y}`}>
                              <circle
                                cx={cx}
                                cy={cy}
                                r={12}
                                fill="rgba(168,85,247,0.35)"
                                stroke="rgb(216,180,254)"
                                strokeWidth={2}
                              />
                              <circle cx={cx} cy={cy} r={3} fill="white" />
                              <text
                                x={cx + 14}
                                y={cy + 4}
                                fill="rgb(233,213,255)"
                                fontSize={13}
                                fontWeight={600}
                              >
                                {label}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    ) : null}
                    {expandActive && expandItem?.id === item.id ? (
                      <div
                        className="absolute inset-0 z-10 touch-none"
                        style={{ width: item.width, height: item.height }}
                      >
                        <ExpandFrameOverlay
                          imageWidth={item.width}
                          imageHeight={item.height}
                          initialAspect={expandRequest?.aspectPreset}
                          onComplete={(padding, aspect) =>
                            onExpandComplete?.(padding, aspect)
                          }
                          onCancel={() => onExpandCancel?.()}
                        />
                      </div>
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
                        {maskBrush.maskStrokes.map((stroke, i) => (
                          <polyline
                            key={`stroke-${i}`}
                            points={stroke
                              .map((p) => `${p.x},${p.y}`)
                              .join(" ")}
                            fill="none"
                            stroke="rgb(216,180,254)"
                            strokeWidth={maskBrush.brushSize}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity={0.85}
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

        {minimapBounds && !isRefineMode && visibleItems.length > 1 && (
          <div className="pointer-events-auto absolute bottom-14 right-3 z-10 overflow-hidden rounded-lg border border-white/10 bg-black/60 backdrop-blur">
            <svg
              width={120}
              height={80}
              viewBox={`${minimapBounds.minX - 40} ${minimapBounds.minY - 40} ${minimapBounds.maxX - minimapBounds.minX + 80} ${minimapBounds.maxY - minimapBounds.minY + 80}`}
              className="block"
            >
              {visibleItems.map((item) => (
                <rect
                  key={item.id}
                  x={item.x}
                  y={item.y}
                  width={item.width}
                  height={item.height}
                  fill={
                    selectedId === item.id
                      ? "rgba(249,115,22,0.5)"
                      : "rgba(255,255,255,0.15)"
                  }
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth={2}
                />
              ))}
              {(() => {
                const container = containerRef.current;
                if (!container) return null;
                const rect = container.getBoundingClientRect();
                const vx = -pan.x / zoom;
                const vy = -pan.y / zoom;
                const vw = rect.width / zoom;
                const vh = rect.height / zoom;
                return (
                  <rect
                    x={vx}
                    y={vy}
                    width={vw}
                    height={vh}
                    fill="none"
                    stroke="rgba(249,115,22,0.6)"
                    strokeWidth={3}
                    strokeDasharray="6 3"
                  />
                );
              })()}
            </svg>
          </div>
        )}

        <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between gap-2 text-[10px] text-zinc-500">
          <div className="pointer-events-auto flex items-center gap-2 rounded-lg bg-black/60 px-2 py-1 backdrop-blur">
            <button
              type="button"
              onClick={() => {
                const container = containerRef.current;
                if (!container) return;
                const rect = container.getBoundingClientRect();
                zoomAtPoint(
                  Math.max(ZOOM_MIN, zoom - 0.1),
                  rect.left + rect.width / 2,
                  rect.top + rect.height / 2,
                );
              }}
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
              onChange={(e) => {
                const container = containerRef.current;
                if (!container) return;
                const rect = container.getBoundingClientRect();
                zoomAtPoint(
                  Number(e.target.value) / 100,
                  rect.left + rect.width / 2,
                  rect.top + rect.height / 2,
                );
              }}
              title="缩放比例"
              className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-zinc-600 [&::-webkit-slider-thumb]:size-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-400"
            />
            <button
              type="button"
              onClick={() => {
                const container = containerRef.current;
                if (!container) return;
                const rect = container.getBoundingClientRect();
                zoomAtPoint(
                  Math.min(ZOOM_MAX, zoom + 0.1),
                  rect.left + rect.width / 2,
                  rect.top + rect.height / 2,
                );
              }}
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
                else fitAll();
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

        {isRefineMode && refineRootItemId && refineChain.length > 0 ? (
          <RefineFilmstrip
            chain={refineChain}
            rootItemId={refineRootItemId}
            activeItemId={refineItemId ?? refineRootItemId}
            onSelect={(id) => onRefineTargetSelect?.(id)}
          />
        ) : null}

        {compareMode && comparePair ? (
          <RefineCompareView
            before={comparePair.before}
            after={comparePair.after}
            onClose={() => onCompareModeChange?.(false)}
          />
        ) : null}
      </div>
    );
  },
);
