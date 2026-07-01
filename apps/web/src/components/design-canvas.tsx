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
import {
  canShowRefineCompare,
  collectRefineChainItems,
  isSingleOutputRefineResult,
  pickLatestBatchId,
  REFINE_SINGLE_OUTPUT_TOOL_IDS,
} from "@/lib/canvas-tools";
import { TOOL_DISPLAY_NAMES } from "@/lib/studio-tool-meta";
import { CanvasToolbar } from "@/components/canvas-toolbar";
import { CanvasContextMenu } from "@/components/canvas-context-menu";
import { CanvasLightbox } from "@/components/canvas-lightbox";
import { ScrollCanvas } from "@/components/scroll-canvas";
import type { ScrollCanvasHandle } from "@/components/scroll-canvas";
import { FreeCanvas } from "@/components/free-canvas";
import type { FreeCanvasHandle } from "@/components/free-canvas";
import { MOBILE_BREAKPOINT } from "@/lib/breakpoints";
import { hapticLight } from "@/lib/haptics";
import { assetUrl } from "@/lib/api-client";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { ArrowLeft, Bookmark, Columns2 } from "lucide-react";
import type { StudioTool } from "@/lib/types";
import { InfiniteCanvasContainer } from "@/components/infinite-canvas/InfiniteCanvasContainer";
import {
  canvasItemsToNodeData,
  buildConnectionsFromItems,
  applyNodePositionsToItems,
} from "@/components/infinite-canvas/migration";
import type { CanvasNodeData, CanvasConnection, CanvasNodeMetadata, ViewportTransform } from "@/components/infinite-canvas/types";
import { CanvasNodeType } from "@/components/infinite-canvas/types";

/** Assign sequential batch index to nodes sharing the same batchRootId (1-based). */
function enrichNodesWithBatchIndex(nodes: CanvasNodeData[]): CanvasNodeData[] {
  const batchOrder = new Map<string, number>();
  let next = 1;
  return nodes.map((n) => {
    const rootId = n.metadata?.batchRootId;
    if (!rootId) return n;
    let idx = batchOrder.get(rootId);
    if (idx === undefined) {
      idx = next++;
      batchOrder.set(rootId, idx);
    }
    return { ...n, metadata: { ...(n.metadata as CanvasNodeMetadata), batchIndex: idx } };
  });
}
import { DramaPropertyPanel } from "@/components/infinite-canvas/drama/DramaPropertyPanel";
import { CanvasAssistantPanel } from "@/components/infinite-canvas/agent/CanvasAssistantPanel";
import { TemplateManager } from "@/components/infinite-canvas/TemplateManager";
import type { CanvasAgentSnapshot, CanvasAgentOp } from "@/components/infinite-canvas/utils";
import { applyCanvasAgentOps } from "@/components/infinite-canvas/utils";

export interface DesignCanvasHandle {
  fitToItem: (itemId: string) => void;
  fitToBatch: (batchId: string) => void;
  scrollToGenerating: () => void;
  pulseItem: (itemId: string) => void;
  fitAll: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  enterRefineMode: (itemId: string) => void;
  exitRefineMode: () => void;
  isInRefineMode: () => boolean;
  beginRefineJob: () => void;
  completeRefineJob: (meta?: { toolName?: string }) => void;
  cancelRefineJob: () => void;
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
  jobErrorMessage?: string | null;
  jobProgressCompleted?: number;
  jobProgressTotal?: number;
  onOpenChatPanel?: () => void;
  selectSourceBanner?: string | null;
  /** 失败时顶部提示条可关闭 */
  showFailureBannerDismiss?: boolean;
  onDismissJobFailure?: () => void;
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
  expandRequest?: {
    key: number;
    itemId: string;
    toolName: string;
    aspectPreset?: import("@/lib/expand-frame").ExpandAspectPreset;
  } | null;
  onExpandComplete?: (
    padding: import("@/lib/expand-frame").ExpandFramePadding,
    aspect: import("@/lib/expand-frame").ExpandAspectPreset,
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
  onJumpToParentBatch?: (
    parentBatchId: string,
    sourceItemId?: string,
  ) => void;
  onRerun?: (item: CanvasItem) => void;
  layoutMode?: CanvasLayoutMode;
  onLayoutModeChange?: (mode: CanvasLayoutMode) => void;
  onCancelJob?: () => void;
  jobElapsedMs?: number;
  queueAhead?: number | null;
  pendingJobPrompt?: string | null;
  jobStartedAt?: number | null;
  /** 滚动画布内容区底部留白（Dock 浮层不占用画布背景高度） */
  scrollBottomInset?: string;
  orchestrationEvent?: import("@/lib/canvas-timeline").OrchestrationTimelineEvent | null;
  orchestrationActions?: import("@/lib/canvas-timeline").OrchestrationTimelineActions;
  orchestrationExtra?: React.ReactNode;
  /** 制片模式等：替换滚动画布主区（仍可在下方展示 orchestrationExtra） */
  alternateCanvasContent?: ReactNode;
  batchTools?: {
    tools: StudioTool[];
    pendingToolId?: string | null;
    onRunTool: (tool: StudioTool, item: CanvasItem) => void;
    onMentionItem?: (item: CanvasItem) => void;
    onExtractVideoLastFrame?: (item: CanvasItem) => void;
    onAddVideoBgm?: (item: CanvasItem) => void;
    videoActionBusy?: boolean;
  };
  onDownloadItem?: (item: CanvasItem) => void;
  onShareItem?: (item: CanvasItem) => void;
  onPublishItem?: (item: CanvasItem) => void;
  /** 切换到无限画布模式（Phase 1 默认 false，Phase 2 默认 true） */
  useInfiniteCanvas?: boolean;
  /** Drama 专用画布节点（由 dramaPlanToCanvasNodes 生成，叠加到 InfiniteCanvas 上） */
  dramaNodes?: CanvasNodeData[];
  /** Drama 节点间连线 */
  dramaConnections?: CanvasConnection[];
  /** Agent 对话面板快照（用于 CanvasAssistantPanel） */
  assistantSnapshot?: CanvasAgentSnapshot | null;
  /** Agent 应用 Ops 时的回调 */
  onApplyAssistantOps?: (ops: CanvasAgentOp[]) => void;
  /** 当前会话 ID（用于 TemplateManager 一键重跑） */
  sessionId?: string;
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
      jobErrorMessage = null,
      jobProgressCompleted = 0,
      jobProgressTotal = 0,
      onOpenChatPanel,
      selectSourceBanner = null,
      showFailureBannerDismiss = false,
      onDismissJobFailure,
      onCutoutItem,
      onExpandItem,
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
      onJumpToParentBatch,
      onRerun,
      layoutMode = "scroll",
      onLayoutModeChange,
      onCancelJob,
      jobElapsedMs,
      queueAhead,
      pendingJobPrompt = null,
      jobStartedAt = null,
      scrollBottomInset = "",
      orchestrationEvent = null,
      orchestrationActions,
      orchestrationExtra,
      alternateCanvasContent,
      batchTools,
      onDownloadItem,
      onShareItem,
      onPublishItem,
      useInfiniteCanvas = false,
      dramaNodes = [],
      dramaConnections = [],
      assistantSnapshot,
      onApplyAssistantOps,
      sessionId,
    },
    ref,
  ) {
    const scrollCanvasRef = useRef<ScrollCanvasHandle>(null);
    const freeCanvasRef = useRef<FreeCanvasHandle>(null);
    const [tool, setTool] = useState<CanvasToolId>("select");
    const [gridOn, setGridOn] = useState(false);
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
    const [refineRootItemId, setRefineRootItemId] = useState<string | null>(
      null,
    );
    const [refineJobPending, setRefineJobPending] = useState(false);
    const [refineCompleteNotice, setRefineCompleteNotice] = useState<{
      count: number;
      toolName?: string;
    } | null>(null);
    const [compareMode, setCompareMode] = useState(false);
    const [infiniteViewport, setInfiniteViewport] = useState<ViewportTransform>({ x: 16, y: 16, k: 1 });
    const [infiniteSelectedIds, setInfiniteSelectedIds] = useState<string[]>([]);
    const [dramaPanelNodeId, setDramaPanelNodeId] = useState<string | null>(null);
    const [showTemplateManager, setShowTemplateManager] = useState(false);

    // Compute the Drama node data for the right-side property panel
    const dramaPanelNode = useMemo<CanvasNodeData | null>(() => {
      if (!dramaPanelNodeId || !useInfiniteCanvas) return null;
      const allNodes = canvasItemsToNodeData(items);
      return allNodes.find((n) => n.id === dramaPanelNodeId) ?? null;
    }, [dramaPanelNodeId, items, useInfiniteCanvas]);

    // Phase 4 Task 4.3 — 选中的节点组（供 TemplateManager 序列化为模板）
    const templateSelectedNodes = useMemo<CanvasNodeData[]>(() => {
      if (!useInfiniteCanvas || infiniteSelectedIds.length === 0) return [];
      const allNodes = [...canvasItemsToNodeData(items), ...dramaNodes];
      const idSet = new Set(infiniteSelectedIds);
      return allNodes.filter((n) => idSet.has(n.id));
    }, [useInfiniteCanvas, infiniteSelectedIds, items, dramaNodes]);

    const templateSelectedConnections = useMemo<CanvasConnection[]>(() => {
      if (templateSelectedNodes.length === 0) return [];
      const idSet = new Set(templateSelectedNodes.map((n) => n.id));
      const allConnections = [...buildConnectionsFromItems(items), ...dramaConnections];
      return allConnections.filter(
        (c) => idSet.has(c.fromNodeId) && idSet.has(c.toNodeId),
      );
    }, [templateSelectedNodes, items, dramaConnections]);

    const refineChainBeforeRef = useRef<Set<string>>(new Set());
    const refineJobMetaRef = useRef<{ toolName?: string } | null>(null);
    const mobile = useIsMobile(MOBILE_BREAKPOINT);
    // Ref to prevent feedback loop when applying assistant ops
    const applyingAssistantOpsRef = useRef(false);

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
      // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // Handle assistant ops - applies CanvasAgentOps to the canvas
    const handleApplyAssistantOps = useCallback((ops: CanvasAgentOp[]): CanvasAgentSnapshot => {
      if (!assistantSnapshot) {
        // Return empty snapshot to satisfy the required return type
        return { projectId: "", title: "", nodes: [], connections: [], selectedNodeIds: [], viewport: { x: 0, y: 0, k: 1 } };
      }

      // Build current snapshot from state
      const currentNodes = [...canvasItemsToNodeData(items), ...dramaNodes];
      const currentConnections = [...buildConnectionsFromItems(items), ...dramaConnections];
      const snapshot: CanvasAgentSnapshot = {
        projectId: assistantSnapshot.projectId ?? "",
        title: assistantSnapshot.title ?? "",
        nodes: currentNodes,
        connections: currentConnections,
        selectedNodeIds: infiniteSelectedIds,
        viewport: infiniteViewport,
      };

      // Apply ops to get new snapshot
      const newSnapshot = applyCanvasAgentOps(snapshot, ops);
      const newNodes = newSnapshot.nodes;

      // Set flag to prevent feedback loop
      applyingAssistantOpsRef.current = true;

      // Separate drama node types
      const dramaNodeTypes = new Set([CanvasNodeType.Script, CanvasNodeType.Shot, CanvasNodeType.Character, CanvasNodeType.Scene]);

      const dramaNodeIds = new Set(dramaNodes.map(n => n.id));
      const newDramaNodeIds = new Set(newNodes.filter(n => dramaNodeTypes.has(n.type)).map(n => n.id));

      // Find added and removed drama nodes
      const addedDramaNodeIds = [...newDramaNodeIds].filter(id => !dramaNodeIds.has(id));
      const removedDramaNodeIds = [...dramaNodeIds].filter(id => !newDramaNodeIds.has(id));

      // If there are drama node changes, notify parent
      if ((addedDramaNodeIds.length > 0 || removedDramaNodeIds.length > 0) && onApplyAssistantOps) {
        onApplyAssistantOps(ops);
      }

      // Update items with position changes from nodes
      const itemNodeIds = new Set(items.map(item => item.id));
      const nodesForItems = newNodes.filter(n => itemNodeIds.has(n.id));

      if (nodesForItems.length > 0 || newNodes.length !== currentNodes.length) {
        const updatedItems = applyNodePositionsToItems(items, newNodes.filter(n => itemNodeIds.has(n.id)));
        onItemsChange(updatedItems);
      }

      // Reset flag after a tick
      setTimeout(() => {
        applyingAssistantOpsRef.current = false;
      }, 0);

      return newSnapshot;
    }, [items, dramaNodes, dramaConnections, assistantSnapshot, infiniteSelectedIds, infiniteViewport, onItemsChange, onApplyAssistantOps]);

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
        if (!item || item.isVideo) return;

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

        setRefineRootItemId(itemId);
        setRefineItemId(itemId);
        setRefineCompleteNotice(null);
        setCompareMode(false);
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
      const chain = refineRootItemId
        ? collectRefineChainItems(items, refineRootItemId)
        : [];
      const latestDerivative = chain.filter((i) => i.id !== refineRootItemId).at(-1);
      const scrollBatchId =
        latestDerivative?.batchId ?? refineItem?.batchId ?? null;

      setRefineItemId(null);
      setRefineRootItemId(null);
      setRefineCompleteNotice(null);
      setCompareMode(false);
      setRefineJobPending(false);
      refineJobMetaRef.current = null;
      setInternalLayoutMode("scroll");
      onLayoutModeChange?.("scroll");
      if (scrollBatchId) {
        setTimeout(() => {
          scrollCanvasRef.current?.scrollToBatch(scrollBatchId);
        }, 100);
      }
    }, [items, refineRootItemId, refineItem, onLayoutModeChange]);

    const selectRefineTarget = useCallback(
      (itemId: string) => {
        setRefineItemId(itemId);
        onSelect(itemId);
        setCompareMode(false);
        hapticLight();
        setTimeout(() => {
          freeCanvasRef.current?.fitToItem(itemId);
        }, 50);
      },
      [onSelect],
    );

    const beginRefineJob = useCallback(() => {
      if (!refineRootItemId) return;
      refineChainBeforeRef.current = new Set(
        collectRefineChainItems(items, refineRootItemId).map((i) => i.id),
      );
    }, [items, refineRootItemId]);

    const completeRefineJob = useCallback(
      (meta?: { toolName?: string }) => {
        refineJobMetaRef.current = meta ?? {};
        setRefineJobPending(true);
      },
      [],
    );

    const cancelRefineJob = useCallback(() => {
      setRefineJobPending(false);
      refineJobMetaRef.current = null;
    }, []);

    useEffect(() => {
      if (!refineJobPending || !refineRootItemId) return;

      const chain = collectRefineChainItems(items, refineRootItemId);
      const newItems = chain.filter(
        (i) => !refineChainBeforeRef.current.has(i.id),
      );
      if (!newItems.length) return;

      setRefineJobPending(false);

      const sorted = [...newItems].sort((a, b) => {
        const bi = a.batchIndex ?? 0;
        const bj = b.batchIndex ?? 0;
        if (bi !== bj) return bj - bi;
        return (b.y ?? 0) - (a.y ?? 0);
      });
      const primary = sorted[0]!;

      setRefineItemId(primary.id);
      onSelect(primary.id);
      pulseItem(primary.id);

      const meta = refineJobMetaRef.current;
      refineJobMetaRef.current = null;
      const toolName = meta?.toolName;

      setRefineCompleteNotice({
        count: newItems.length,
        toolName,
      });

      const singleOutput =
        newItems.length === 1 &&
        isSingleOutputRefineResult(items, primary) &&
        (!toolName || REFINE_SINGLE_OUTPUT_TOOL_IDS.has(toolName));

      if (
        singleOutput &&
        canShowRefineCompare(items, refineRootItemId, primary.id)
      ) {
        setCompareMode(true);
      } else {
        setCompareMode(false);
      }

      setTimeout(() => {
        freeCanvasRef.current?.fitToItem(primary.id);
      }, 100);
    }, [items, refineJobPending, refineRootItemId, onSelect, pulseItem]);

    useEffect(() => {
      if (!refineItemId) return;
      const item = items.find((i) => i.id === refineItemId);
      if (!item) {
        setRefineItemId(null);
        setRefineRootItemId(null);
        setRefineCompleteNotice(null);
        setCompareMode(false);
        setInternalLayoutMode("scroll");
        onLayoutModeChange?.("scroll");
      }
    }, [items, refineItemId, onLayoutModeChange]);

    useImperativeHandle(
      ref,
      () => ({
        fitToItem: (itemId: string) =>
          freeCanvasRef.current?.fitToItem(itemId),
        fitToBatch: (batchId: string) => {
          if (isRefineMode) {
            freeCanvasRef.current?.fitToBatch(batchId);
          } else {
            scrollCanvasRef.current?.scrollToBatch(batchId);
          }
        },
        scrollToGenerating: () => {
          scrollCanvasRef.current?.scrollToGenerating();
        },
        pulseItem,
        fitAll: () => freeCanvasRef.current?.fitAll(),
        undo,
        redo,
        canUndo,
        canRedo,
        enterRefineMode,
        exitRefineMode,
        isInRefineMode: () =>
          Boolean(refineItemId && internalLayoutMode === "free"),
        beginRefineJob,
        completeRefineJob,
        cancelRefineJob,
      }),
      [
        pulseItem,
        undo,
        redo,
        canUndo,
        canRedo,
        enterRefineMode,
        exitRefineMode,
        refineItemId,
        internalLayoutMode,
        beginRefineJob,
        completeRefineJob,
        cancelRefineJob,
        isRefineMode,
      ],
    );

    useEffect(() => {
      if (!brushRequest) return;
      setRefineRootItemId((root) => root ?? brushRequest.itemId);
      setRefineItemId(brushRequest.itemId);
      onSelect(brushRequest.itemId);
      if (internalLayoutMode !== "free") {
        setInternalLayoutMode("free");
        onLayoutModeChange?.("free");
      }
    }, [brushRequest, internalLayoutMode, onLayoutModeChange, onSelect]);

    useEffect(() => {
      if (!expandRequest) return;
      setRefineRootItemId((root) => root ?? expandRequest.itemId);
      setRefineItemId(expandRequest.itemId);
      onSelect(expandRequest.itemId);
      if (internalLayoutMode !== "free") {
        setInternalLayoutMode("free");
        onLayoutModeChange?.("free");
      }
    }, [expandRequest, internalLayoutMode, onLayoutModeChange, onSelect]);

    useEffect(() => {
      if (!focusClickRequest) return;
      setRefineRootItemId((root) => root ?? focusClickRequest.itemId);
      setRefineItemId(focusClickRequest.itemId);
      onSelect(focusClickRequest.itemId);
      if (internalLayoutMode !== "free") {
        setInternalLayoutMode("free");
        onLayoutModeChange?.("free");
      }
    }, [focusClickRequest, internalLayoutMode, onLayoutModeChange, onSelect]);

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

    const showFreeCanvas = isRefineMode;

    const refineChain = useMemo(() => {
      if (!refineRootItemId) return [];
      return collectRefineChainItems(items, refineRootItemId);
    }, [items, refineRootItemId]);

    const comparePair = useMemo(() => {
      if (!refineRootItemId || !refineItemId) return null;
      return canShowRefineCompare(items, refineRootItemId, refineItemId);
    }, [items, refineRootItemId, refineItemId]);

    const compareAvailable = Boolean(comparePair);

    return (
      <div
        className={`flex min-h-0 min-w-0 flex-1 overflow-hidden bg-[#0d0d0d] ${
          mobile ? "flex-col" : "flex-row"
        }`}
      >
        {!mobile && showFreeCanvas ? (
          <CanvasToolbar
            active={tool}
            gridOn={gridOn}
            onTool={handleTool}
            layoutMode="free"
            canUndo={canUndo}
            canRedo={canRedo}
          />
        ) : null}

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {selectSourceBanner ? (
            <div className="absolute left-2 right-2 top-2 z-20 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
              <span className="min-w-0 flex-1">{selectSourceBanner}</span>
              {showFailureBannerDismiss && onDismissJobFailure ? (
                <button
                  type="button"
                  onClick={onDismissJobFailure}
                  className="shrink-0 rounded p-0.5 text-amber-200/70 transition hover:bg-amber-500/20 hover:text-amber-50"
                  aria-label="关闭提示"
                >
                  ×
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="absolute left-2 top-2 z-20 flex flex-wrap items-center gap-2">
            {isRefineMode ? (
              <button
                type="button"
                onClick={exitRefineMode}
                className="flex items-center gap-1.5 rounded-lg bg-orange-500/20 px-3 py-1.5 text-xs text-orange-300 transition hover:bg-orange-500/30 hover:text-orange-100"
              >
                <ArrowLeft className="size-3.5" />
                <span>返回纵向模式</span>
              </button>
            ) : null}
            {isRefineMode && refineCompleteNotice ? (
              <div
                data-testid="refine-complete-notice"
                className="max-w-md rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100/90"
              >
                精修完成
                {refineCompleteNotice.toolName
                  ? ` · ${TOOL_DISPLAY_NAMES[refineCompleteNotice.toolName] ?? refineCompleteNotice.toolName}`
                  : ""}
                {refineCompleteNotice.count > 1
                  ? ` · 共 ${refineCompleteNotice.count} 张，可在下方胶片切换`
                  : " · 已切换到最新结果"}
              </div>
            ) : null}
            {isRefineMode && compareAvailable ? (
              <button
                type="button"
                data-testid="refine-compare-toggle"
                onClick={() => setCompareMode((v) => !v)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition ${
                  compareMode
                    ? "bg-orange-500/25 text-orange-200"
                    : "bg-white/10 text-zinc-300 hover:bg-white/15"
                }`}
              >
                <Columns2 className="size-3.5" />
                <span>{compareMode ? "退出对比" : "Before/After"}</span>
              </button>
            ) : null}
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

          {alternateCanvasContent ? (
            <div
              className="absolute inset-0 flex min-h-0 flex-col overflow-hidden"
              style={{ paddingBottom: scrollBottomInset }}
            >
              <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
                {alternateCanvasContent}
              </div>
              {orchestrationExtra ? (
                <div
                  className="shrink-0 border-t border-white/5 p-2 sm:p-3"
                  data-testid="orchestration-extra-section"
                >
                  {orchestrationExtra}
                </div>
              ) : null}
            </div>
          ) : useInfiniteCanvas ? (
            <div className="flex min-h-0 flex-1">
              <div className="relative flex min-h-0 flex-1">
                <InfiniteCanvasContainer
                  nodes={enrichNodesWithBatchIndex([...canvasItemsToNodeData(items), ...dramaNodes])}
                  connections={[...buildConnectionsFromItems(items), ...dramaConnections]}
                  viewport={infiniteViewport}
                  selectedNodeIds={infiniteSelectedIds}
                  onNodesChange={(nodes: CanvasNodeData[]) => {
                    // Skip if we're applying assistant ops to prevent feedback loop
                    if (applyingAssistantOpsRef.current) return;
                    onItemsChange(applyNodePositionsToItems(items, nodes));
                  }}
                  onConnectionsChange={() => {
                    // Phase 1: connections not persisted back to CanvasItem
                  }}
                  onViewportChange={setInfiniteViewport}
                  onSelectionChange={setInfiniteSelectedIds}
                  onNodeDoubleClick={(nodeId: string) => {
                    onSelect(nodeId);
                    setDramaPanelNodeId(nodeId);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowTemplateManager((v) => !v)}
                  className={`absolute right-3 top-3 z-20 inline-flex size-8 items-center justify-center rounded-md border transition ${
                    showTemplateManager
                      ? "bg-white/20 text-white"
                      : "bg-black/40 text-zinc-300 hover:bg-black/60"
                  }`}
                  style={{ borderColor: "rgba(255,255,255,0.15)" }}
                  aria-label="工作流模板"
                  title="工作流模板"
                  data-testid="template-manager-toggle"
                >
                  <Bookmark className="size-4" />
                </button>
              </div>
              {dramaPanelNode && (
                <DramaPropertyPanel
                  node={dramaPanelNode}
                  onClose={() => setDramaPanelNodeId(null)}
                />
              )}
              {assistantSnapshot && (
                <CanvasAssistantPanel
                  snapshot={assistantSnapshot}
                  onApplyOps={handleApplyAssistantOps}
                  initialCollapsed
                />
              )}
              {showTemplateManager && (
                <TemplateManager
                  selectedNodes={templateSelectedNodes}
                  connections={templateSelectedConnections}
                  sessionId={sessionId}
                  onClose={() => setShowTemplateManager(false)}
                />
              )}
            </div>
          ) : showFreeCanvas ? (
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
              isRefineMode
              refineItemId={refineItemId}
              refineRootItemId={refineRootItemId}
              refineChain={refineChain}
              onRefineTargetSelect={selectRefineTarget}
              compareMode={compareMode}
              comparePair={comparePair}
              onCompareModeChange={setCompareMode}
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
              expandRequest={expandRequest}
              onExpandComplete={onExpandComplete}
              onExpandCancel={onExpandCancel}
              focusClickRequest={focusClickRequest}
              onFocusImageClick={onFocusImageClick}
              onFocusClickCancel={onFocusClickCancel}
              selectionToolbar={selectionToolbar}
              statusChip={statusChip}
              jobStreamStatus={jobStreamStatus}
              jobFailed={jobFailed}
              jobErrorMessage={jobErrorMessage}
              jobProgressCompleted={jobProgressCompleted}
              jobProgressTotal={jobProgressTotal}
              onOpenChatPanel={onOpenChatPanel}
              onCancelJob={onCancelJob}
              onDismissJobFailure={onDismissJobFailure}
              jobElapsedMs={jobElapsedMs}
              queueAhead={queueAhead}
              mobile={mobile}
            />
          ) : (
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
              jobStreamStatus={jobStreamStatus}
              jobFailed={jobFailed}
              jobErrorMessage={jobErrorMessage}
              jobProgressCompleted={jobProgressCompleted}
              jobProgressTotal={jobProgressTotal}
              onOpenChatPanel={onOpenChatPanel}
              onCancelJob={onCancelJob}
              onDismissJobFailure={onDismissJobFailure}
              jobElapsedMs={jobElapsedMs}
              queueAhead={queueAhead}
              pendingJobPrompt={pendingJobPrompt}
              jobStartedAt={jobStartedAt}
              focusClickActive={focusClickActive}
              focusItem={focusItem ?? null}
              onFocusImageClick={onFocusImageClick}
              scrollBottomInset={scrollBottomInset}
              orchestrationEvent={orchestrationEvent}
              orchestrationActions={orchestrationActions}
              orchestrationExtra={orchestrationExtra}
              batchTools={batchTools}
              onDownloadItem={
                onDownloadItem ??
                ((item) => window.open(assetUrl(item.url), "_blank"))
              }
              onShareItem={onShareItem}
              onPublishItem={onPublishItem}
            />
          )}

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
            onRefine={
              !readOnly
                ? () => {
                    const item = lightbox.items[lightbox.index];
                    if (!item || item.isVideo) return;
                    setLightbox(null);
                    enterRefineMode(item.id);
                  }
                : undefined
            }
          />
        )}
      </div>
    );
  },
);
