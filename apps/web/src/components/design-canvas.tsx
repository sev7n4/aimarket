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
import { assetUrl } from "@/lib/api-client";
import type {
  CanvasItem,
  CanvasMaskSelection,
  CanvasToolId,
  CanvasLayoutMode,
} from "@/lib/canvas-tools";
import { batchDisplayIndex, pickLatestBatchId } from "@/lib/canvas-tools";
import { CanvasToolbar } from "@/components/canvas-toolbar";
import { CanvasJobOverlay } from "@/components/canvas-job-overlay";
import { CanvasContextMenu } from "@/components/canvas-context-menu";
import { CanvasLightbox } from "@/components/canvas-lightbox";
import { MOBILE_BREAKPOINT } from "@/lib/breakpoints";
import { canvasSelectionHint } from "@/lib/mobile-labels";
import { hapticLight } from "@/lib/haptics";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { Sparkles, Wand2, Expand, Crop, Eraser, Eye, Trash2, ArrowLeft, RotateCcw } from "lucide-react";

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 6;

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

interface ImageActionBarProps {
  item: CanvasItem;
  onPreview: () => void;
  onRefine: () => void;
  onDelete: () => void;
  position: { top: number; left: number };
}

function ImageActionBar({ item, onPreview, onRefine, onDelete, position }: ImageActionBarProps) {
  return (
    <div
      className="absolute z-30 flex items-center gap-1 rounded-lg bg-black/90 border border-white/20 px-2 py-1.5 shadow-xl backdrop-blur-sm"
      style={{ top: position.top, left: position.left }}
    >
      <button
        type="button"
        onClick={onPreview}
        className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs text-zinc-300 transition hover:bg-white/20 hover:text-white"
        title="预览"
      >
        <Eye className="size-3.5" />
        <span>预览</span>
      </button>
      <button
        type="button"
        onClick={onRefine}
        className="flex items-center gap-1 rounded-md bg-orange-500/20 px-2 py-1 text-xs text-orange-300 transition hover:bg-orange-500/30 hover:text-orange-100"
        title="精修"
      >
        <Wand2 className="size-3.5" />
        <span>精修</span>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="flex items-center gap-1 rounded-md bg-red-500/20 px-2 py-1 text-xs text-red-300 transition hover:bg-red-500/30 hover:text-red-100"
        title="删除"
      >
        <Trash2 className="size-3.5" />
        <span>删除</span>
      </button>
    </div>
  );
}

interface AiToolAction {
  id: string;
  label: string;
  icon: ReactNode;
  action: string;
}

const aiTools: AiToolAction[] = [
  { id: "rerun", label: "重跑", icon: <RotateCcw className="size-3.5" />, action: "rerun" },
  { id: "remix", label: "变体", icon: <Sparkles className="size-3.5" />, action: "remix" },
  { id: "expand", label: "扩图", icon: <Expand className="size-3.5" />, action: "expand" },
  { id: "crop", label: "裁剪", icon: <Crop className="size-3.5" />, action: "crop" },
  { id: "erase", label: "擦除", icon: <Eraser className="size-3.5" />, action: "erase" },
  { id: "edit", label: "编辑", icon: <Wand2 className="size-3.5" />, action: "edit" },
];

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
      layoutMode = "scroll",
      onLayoutModeChange,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
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
    const [lightbox, setLightbox] = useState<{ items: CanvasItem[]; index: number } | null>(null);
    const [internalLayoutMode, setInternalLayoutMode] = useState<CanvasLayoutMode>(layoutMode);
    const [refineItemId, setRefineItemId] = useState<string | null>(null);
    const [actionBarPosition, setActionBarPosition] = useState<{ top: number; left: number } | null>(null);
    const refineItem = refineItemId ? items.find((item) => item.id === refineItemId) : null;
    const isRefineMode = Boolean(refineItemId && refineItem && internalLayoutMode === "free");
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
    const focusItem =
      focusClickRequest
        ? items.find((item) => item.id === focusClickRequest.itemId)
        : null;
    const focusClickActive = Boolean(focusClickRequest && focusItem);
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
    
    const handleItemsChangeWithHistory = useCallback((newItems: CanvasItem[]) => {
      pushHistory(newItems);
      onItemsChange(newItems);
    }, [pushHistory, onItemsChange]);

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

    const fitToBatch = useCallback((batchId: string) => {
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
      const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(scaleX, scaleY, 1.15)));
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      setZoom(nextZoom);
      setPan({
        x: rect.width / 2 - cx * nextZoom,
        y: rect.height / 2 - cy * nextZoom,
      });
    }, [items, mobile]);

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

    const enterRefineMode = useCallback((itemId: string) => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;
      setRefineItemId(itemId);
      setInternalLayoutMode("free");
      onLayoutModeChange?.("free");
      onSelect(itemId);
      setActionBarPosition(null);
      setTimeout(() => {
        fitToItem(itemId);
      }, 100);
    }, [items, onLayoutModeChange, onSelect, fitToItem]);

    const exitRefineMode = useCallback(() => {
      const batchId = refineItem?.batchId;
      setRefineItemId(null);
      setInternalLayoutMode("scroll");
      onLayoutModeChange?.("scroll");
      setZoom(1);
      setPan({ x: 0, y: 0 });
      if (batchId) {
        setTimeout(() => {
          fitToBatch(batchId);
        }, 100);
      }
    }, [refineItem, onLayoutModeChange, fitToBatch]);

    useEffect(() => {
      if (!refineItemId) return;
      const item = items.find((i) => i.id === refineItemId);
      if (!item) {
        setRefineItemId(null);
      }
    }, [items, refineItemId]);

    useImperativeHandle(ref, () => ({ 
      fitToItem, 
      fitToBatch, 
      pulseItem, 
      fitAll, 
      undo, 
      redo, 
      canUndo, 
      canRedo,
      enterRefineMode,
      exitRefineMode,
    }), [
      fitToItem,
      fitToBatch,
      pulseItem,
      fitAll,
      undo,
      redo,
      canUndo,
      canRedo,
      enterRefineMode,
      exitRefineMode,
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

    useEffect(() => {
      if (!focusClickRequest) return;
      setTool("select");
      onSelect(focusClickRequest.itemId);
      window.requestAnimationFrame(() => fitToItem(focusClickRequest.itemId));
    }, [focusClickRequest, fitToItem, onSelect]);

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
          const latestBatch = pickLatestBatchId(items);
          if (latestBatch) fitToBatch(latestBatch);
          else fitAll();
        } else if (id === "grid") setGridOn((g) => !g);
        else if (id === "upload") {
          if (!readOnly) onUpload();
        } else if (id === "download") onDownload();
        else if (id === "delete") {
          if (readOnly) return;
          if (selectedId) onDeleteSelected();
          else setTool("select");
        } else if (id === "undo") {
          undo();
        } else if (id === "redo") {
          redo();
        } else if (id === "layout-scroll") {
          setInternalLayoutMode("scroll");
          onLayoutModeChange?.("scroll");
          setZoom(1);
          setPan({ x: 0, y: 0 });
        } else if (id === "layout-free") {
          setInternalLayoutMode("free");
          onLayoutModeChange?.("free");
        } else if (id === "preview") {
          if (items.length > 0) {
            const startIndex = selectedId 
              ? items.findIndex((i) => i.id === selectedId) 
              : 0;
            setLightbox({ items, index: startIndex >= 0 ? startIndex : 0 });
          }
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
        fitToBatch,
        items,
        undo,
        redo,
        onLayoutModeChange,
      ],
    );

    function onCanvasPointerDown(e: React.PointerEvent) {
      if (internalLayoutMode === "scroll") {
        return;
      }
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
      if (internalLayoutMode === "scroll") return;
      if (!readOnly && dragRef.current && tool === "select") {
        const d = dragRef.current;
        const dx = (e.clientX - d.startX) / zoom;
        const dy = (e.clientY - d.startY) / zoom;
        handleItemsChangeWithHistory(
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
        if (internalLayoutMode === "scroll") {
          return;
        }
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
    }, [touchUi, wheelZoomStep, internalLayoutMode]);

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
        if (e.key === "Delete" || e.key === "Backspace") {
          const tag = (e.target as HTMLElement).tagName;
          if (tag === "INPUT" || tag === "TEXTAREA") return;
          if (readOnly || !selectedId) return;
          e.preventDefault();
          onDeleteSelected();
        } else if ((e.metaKey || e.ctrlKey) && e.key === "z") {
          const tag = (e.target as HTMLElement).tagName;
          if (tag === "INPUT" || tag === "TEXTAREA") return;
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        }
      }
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [selectedId, onDeleteSelected, readOnly, undo, redo]);

    const showJobOverlay =
      Boolean(jobStreamStatus) &&
      jobStreamStatus !== "succeeded" &&
      jobStreamStatus !== "failed";
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
          
          <div className="absolute right-2 top-2 z-20 flex items-center gap-1">
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
                onClick={() => handleTool(internalLayoutMode === "scroll" ? "layout-free" : "layout-scroll")}
                className={`rounded-lg px-2.5 py-1.5 text-xs transition ${
                  internalLayoutMode === "scroll"
                    ? "bg-white/15 text-white"
                    : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                }`}
              >
                {internalLayoutMode === "scroll" ? "纵向滚动" : "自由布局"}
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
                在工作站输入短 prompt 后提交；最多 10 个焦点，连续点击间隔约 1.5 秒。
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

          {internalLayoutMode === "scroll" ? (
            <div
              ref={scrollContainerRef}
              className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
              onClick={() => onSelect(null)}
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
              
              {items.length === 0 ? (
                <div className="flex h-[min(60vh,480px)] w-full items-center justify-center p-8">
                  <p className="text-sm text-zinc-600">{emptyHint}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-6 p-4">
                  {batchSections.map((section) => {
                    const batchItems = items.filter((i) => i.batchId === section.id);
                    const parentNum =
                      section.parentBatchId
                        ? batchDisplayIndex(items, section.parentBatchId)
                        : null;
                    return (
                      <div
                        key={section.id}
                        data-testid={`canvas-batch-section-${section.id}`}
                        className="rounded-2xl border border-white/10 bg-black/20 p-3"
                      >
                        <div className="flex items-center justify-between gap-4 mb-3">
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
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {batchItems.map((item) => (
                            <div
                              key={item.id}
                              role="button"
                              tabIndex={0}
                              data-testid={`canvas-item-${item.id}`}
                              className={`relative overflow-hidden rounded-xl border-2 bg-zinc-900 shadow-lg transition ${
                                selectedId === item.id
                                  ? "border-orange-500 ring-2 ring-orange-500/30"
                                  : "border-white/10 hover:border-white/25"
                              } ${pulseId === item.id ? "animate-pulse ring-4 ring-orange-400/50" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (focusClickActive && focusItem?.id === item.id) {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const x = (e.clientX - rect.left) / rect.width;
                                  const y = (e.clientY - rect.top) / rect.height;
                                  onFocusImageClick?.(item, { x, y });
                                  hapticLight();
                                } else {
                                  onSelect(item.id);
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
                                  setActionBarPosition({
                                    top: rect.bottom + 8 - scrollTop,
                                    left: rect.left,
                                  });
                                  hapticLight();
                                }
                              }}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (focusClickActive) return;
                                setLightbox({ items: batchItems, index: batchItems.findIndex((i) => i.id === item.id) });
                                setActionBarPosition(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  onSelect(item.id);
                                }
                              }}
                            >
                              {selectedId === item.id && actionBarPosition && !focusClickActive && (
                                <ImageActionBar
                                  item={item}
                                  onPreview={() => {
                                    setLightbox({ items: batchItems, index: batchItems.findIndex((i) => i.id === item.id) });
                                    setActionBarPosition(null);
                                  }}
                                  onRefine={() => {
                                    enterRefineMode(item.id);
                                  }}
                                  onDelete={() => {
                                    onSelect(item.id);
                                    onDeleteSelected();
                                    setActionBarPosition(null);
                                  }}
                                  position={actionBarPosition}
                                />
                              )}
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
                                  className="pointer-events-none w-full aspect-square object-cover"
                                  draggable={false}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                        
                        {onAiToolAction && batchItems.length > 0 && (
                          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                            {aiTools.map((aiTool) => {
                              const needsRefine = ["remix", "expand", "crop", "erase"].includes(aiTool.action);
                              const isRerun = aiTool.action === "rerun";
                              return (
                              <button
                                key={aiTool.id}
                                type="button"
                                onClick={() => {
                                  const firstItem = batchItems[0];
                                  if (firstItem) {
                                    if (needsRefine) {
                                      enterRefineMode(firstItem.id);
                                      setTimeout(() => {
                                        onAiToolAction(firstItem, aiTool.action);
                                      }, 200);
                                    } else {
                                      onAiToolAction(firstItem, aiTool.action);
                                    }
                                  }
                                }}
                                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition ${
                                  needsRefine
                                    ? "bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 hover:text-orange-100"
                                    : isRerun
                                      ? "bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 hover:text-blue-100"
                                      : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                                }`}
                              >
                                {aiTool.icon}
                                <span>{aiTool.label}</span>
                              </button>
                            )})}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
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
                <>
                  {batchSections.map((section) => {
                    const parentNum =
                      section.parentBatchId
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
                    const batchItems = items.filter((i) => i.batchId === item.batchId);
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
                        setLightbox({ items: batchItems.length > 0 ? batchItems : [item], index: batchItems.findIndex((i) => i.id === item.id) || 0 });
                      }}
                      className={`relative overflow-hidden rounded-xl border-2 bg-zinc-900 text-left shadow-lg transition ${
                        focusClickActive && focusItem?.id === item.id
                          ? "cursor-crosshair"
                          : tool === "select"
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
                        <img
                          src={assetUrl(item.url)}
                          alt=""
                          className="pointer-events-none w-full object-cover"
                          style={{ height: item.height }}
                          draggable={false}
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
                    );
                  })}
                </>
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
