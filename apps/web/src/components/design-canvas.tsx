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
import type { DramaStudioViewPhase } from "@/lib/drama-studio-view";
import { toggleDramaStudioViewPhase } from "@/lib/drama-studio-view";
import { CanvasContextMenu } from "@/components/canvas-context-menu";
import { CanvasLightbox } from "@/components/canvas-lightbox";
import { CanvasJobOverlay } from "@/components/canvas-job-overlay";
import { ScrollCanvas } from "@/components/scroll-canvas";
import type { ScrollCanvasHandle } from "@/components/scroll-canvas";
import { ScrollCanvasOrchestrationCard } from "@/components/scroll-canvas-orchestration-card";
import { FreeCanvas } from "@/components/free-canvas";
import type { FreeCanvasHandle } from "@/components/free-canvas";
import { MOBILE_BREAKPOINT } from "@/lib/breakpoints";
import { hapticLight } from "@/lib/haptics";
import { assetUrl } from "@/lib/api-client";
import type { InfiniteNodeToolRequest } from "@/lib/infinite-node-tool-run";
import {
  resolveNodeImageUrl,
  resolveNodeToolPrompt,
} from "@/lib/infinite-node-tool-run";
import { VideoInpaintEditor } from "@/components/video-inpaint-editor";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { ArrowLeft, Bookmark, Columns2, MessageCircle, Music, Network, Plus } from "lucide-react";
import type { StudioTool } from "@/lib/types";
import { InfiniteCanvasContainer } from "@/components/infinite-canvas/InfiniteCanvasContainer";
import { InfiniteCanvasContextMenu } from "@/components/infinite-canvas/InfiniteCanvasContextMenu";
import { canvasTheme } from "@/components/infinite-canvas/canvas-theme";
import { LightingOverlay, type LightSource } from "@/components/infinite-canvas/drama/LightingOverlay";
import { CameraOverlay, type CameraParams as DramaCameraParams } from "@/components/infinite-canvas/drama/CameraOverlay";
import {
  canvasItemsToNodeData,
  mergeCanvasConnections,
  applyNodePositionsToItems,
} from "@/components/infinite-canvas/migration";
import { ConnectionContextMenu } from "@/components/infinite-canvas/ConnectionContextMenu";
import type { CanvasNodeData, CanvasConnection, CanvasNodeMetadata, ViewportTransform, ContextMenuState } from "@/components/infinite-canvas/types";
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
import { MusicGenPanel } from "@/components/infinite-canvas/drama/MusicGenPanel";
import { NodeCreateMenu } from "@/components/infinite-canvas/NodeCreateMenu";
import { ConnectionCreateMenu } from "@/components/infinite-canvas/ConnectionCreateMenu";
import { extractDramaCanvasOps } from "@/components/infinite-canvas/drama/drama-canvas-mutations";
import {
  buildAddNodeOp,
  buildDeleteConnectionOps,
  extractPersistedConnections,
  isDramaNodeId,
  mergeSnapshotToCanvasItems,
} from "@/components/infinite-canvas/sync-infinite-snapshot";
import {
  applyCanvasAgentOps,
  isCanvasStateOp,
  isExternalAgentOp,
  type AgentExternalAction,
  type CanvasAgentOp,
  type CanvasAgentSnapshot,
} from "@/components/infinite-canvas/utils";

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
  /** InfiniteCanvas 手动连线（持久化到 canvas_layout.infiniteConnections） */
  infiniteConnections?: CanvasConnection[];
  onInfiniteConnectionsChange?: (connections: CanvasConnection[]) => void;
  dramaNodePositions?: Record<string, { x: number; y: number }>;
  onDramaNodePositionsChange?: (
    positions: Record<string, { x: number; y: number }>,
  ) => void;
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
  /** 制片模式：Agent 对话车道 vs 节点编排阶段分离 */
  dramaPhaseSplitEnabled?: boolean;
  dramaViewPhase?: DramaStudioViewPhase;
  onDramaViewPhaseChange?: (phase: DramaStudioViewPhase) => void;
  /** Drama 专用画布节点（由 dramaPlanToCanvasNodes 生成，叠加到 InfiniteCanvas 上） */
  dramaNodes?: CanvasNodeData[];
  /** Drama 节点间连线 */
  dramaConnections?: CanvasConnection[];
  /** Agent 对话面板快照（用于 CanvasAssistantPanel） */
  assistantSnapshot?: CanvasAgentSnapshot | null;
  /** Agent 应用 Ops 时的回调（Drama 草稿写回） */
  onApplyAssistantOps?: (ops: CanvasAgentOp[]) => void;
  /** 制片草稿存在时展示 Drama 类节点创建项 */
  allowDramaNodeCreate?: boolean;
  /** Agent 外部动作（规划/制作/生成）回调，由 Studio 对接 API */
  onAgentExternalAction?: (action: AgentExternalAction) => void;
  /** 当前会话 ID（用于 TemplateManager 一键重跑） */
  sessionId?: string;
  /** Phase 4：InfiniteCanvas 节点右键触发后端工具 */
  onRunInfiniteNodeTool?: (request: InfiniteNodeToolRequest) => void;
  /** Phase 4.3：模板重跑启动（planRunId + 模板 payload，用于节点布局还原） */
  onTemplatePlanRunStarted?: (
    planRunId: string,
    template: Record<string, unknown>,
  ) => void;
  /** Phase 4：更新 Drama 分镜节点摄影参数（不触发重新生成） */
  onPatchDramaShotNode?: (
    nodeId: string,
    patch: {
      cameraShotSize?: string;
      cameraMovement?: string;
      cameraLighting?: string;
      visualPrompt?: string;
    },
  ) => void;
}

export const DesignCanvas = forwardRef<DesignCanvasHandle, DesignCanvasProps>(
  function DesignCanvas(
    {
      items,
      infiniteConnections = [],
      onInfiniteConnectionsChange,
      dramaNodePositions = {},
      onDramaNodePositionsChange,
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
      dramaPhaseSplitEnabled = false,
      dramaViewPhase = "agent",
      onDramaViewPhaseChange,
      dramaNodes = [],
      dramaConnections = [],
      assistantSnapshot,
      onApplyAssistantOps,
      onAgentExternalAction,
      allowDramaNodeCreate = false,
      sessionId,
      onRunInfiniteNodeTool,
      onPatchDramaShotNode,
      onTemplatePlanRunStarted,
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
    const [showMusicGenPanel, setShowMusicGenPanel] = useState(false);
    // Phase 4 Task 4.1/4.2：无限画布节点右键菜单
    const [infiniteContextMenu, setInfiniteContextMenu] = useState<{
      node: CanvasNodeData;
      x: number;
      y: number;
    } | null>(null);
    const [paneCreateMenu, setPaneCreateMenu] = useState<{
      x: number;
      y: number;
      worldX: number;
      worldY: number;
    } | null>(null);
    const [connectionContextMenu, setConnectionContextMenu] = useState<{
      connectionId: string;
      x: number;
      y: number;
    } | null>(null);
    const [connectionCreateMenu, setConnectionCreateMenu] = useState<{
      sourceNodeId: string;
      x: number;
      y: number;
    } | null>(null);
    const infiniteCanvasAreaRef = useRef<HTMLDivElement>(null);
    // 视频精准编辑 / 灯光 / 摄像机 浮层（用于右侧打开）
    const [showVideoInpaint, setShowVideoInpaint] = useState<{
      node: CanvasNodeData;
    } | null>(null);
    const [showLighting, setShowLighting] = useState<{
      node: CanvasNodeData;
    } | null>(null);
    const [showCamera, setShowCamera] = useState<{
      node: CanvasNodeData;
    } | null>(null);
    const [videoInpaintSubmitting, setVideoInpaintSubmitting] = useState(false);

    const runInfiniteNodeTool = useCallback(
      (toolId: string, node: CanvasNodeData, extra?: Partial<InfiniteNodeToolRequest>) => {
        if (!onRunInfiniteNodeTool) {
          console.warn("[infinite-canvas] onRunInfiniteNodeTool 未接入");
          return;
        }
        onRunInfiniteNodeTool({
          toolId,
          node,
          prompt: extra?.prompt ?? resolveNodeToolPrompt(node),
          toolContext: extra?.toolContext,
        });
      },
      [onRunInfiniteNodeTool],
    );
    const allCanvasNodes = useMemo<CanvasNodeData[]>(
      () => [...canvasItemsToNodeData(items), ...dramaNodes],
      [items, dramaNodes],
    );
    const canvasConnections = useMemo(
      () => mergeCanvasConnections(items, infiniteConnections, dramaConnections),
      [items, infiniteConnections, dramaConnections],
    );
    const allCanvasNodesRef = useRef<CanvasNodeData[]>(allCanvasNodes);
    useEffect(() => {
      allCanvasNodesRef.current = allCanvasNodes;
    }, [allCanvasNodes]);

    // Compute the Drama node data for the right-side property panel
    // (must look in all canvas nodes — including dramaNodes — since drama
    // Script/Shot/Character/Scene only live in dramaNodes, not in items)
    const dramaPanelNode = useMemo<CanvasNodeData | null>(() => {
      if (!dramaPanelNodeId || !useInfiniteCanvas) return null;
      return allCanvasNodes.find((n) => n.id === dramaPanelNodeId) ?? null;
    }, [dramaPanelNodeId, allCanvasNodes, useInfiniteCanvas]);

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
      return canvasConnections.filter(
        (c) => idSet.has(c.fromNodeId) && idSet.has(c.toNodeId),
      );
    }, [templateSelectedNodes, canvasConnections]);

    const showInfiniteJobOverlay =
      Boolean(jobStreamStatus) &&
      jobStreamStatus !== "succeeded" &&
      jobStreamStatus !== "failed";

    // 节点编排阶段：Infinite 主区 + 精简操作条；Agent 阶段：Scroll 时间线 + 完整 Studio 面板
    const isWorkflowInfinite =
      useInfiniteCanvas &&
      dramaPhaseSplitEnabled &&
      dramaViewPhase === "workflow";

    const showInfiniteOrchestrationExtra =
      Boolean(orchestrationExtra) &&
      isWorkflowInfinite;

    const showLegacyInfiniteOrchestration =
      useInfiniteCanvas &&
      !dramaPhaseSplitEnabled &&
      Boolean(orchestrationEvent);

    const infiniteOrchestrationDock =
      isWorkflowInfinite &&
      (Boolean(alternateCanvasContent) || showInfiniteOrchestrationExtra);
    const legacyInfiniteOrchestrationDock =
      showLegacyInfiniteOrchestration &&
      (Boolean(alternateCanvasContent) ||
        Boolean(orchestrationEvent) ||
        Boolean(orchestrationExtra));

    // Agent 面板使用实时画布快照（含 items + dramaNodes），而非 Studio 传入的空 nodes
    const effectiveAssistantSnapshot = useMemo<CanvasAgentSnapshot | null>(() => {
      if (!useInfiniteCanvas && !assistantSnapshot) return null;
      return {
        projectId: assistantSnapshot?.projectId ?? "",
        title: assistantSnapshot?.title ?? "AIMarket Canvas",
        nodes: [...canvasItemsToNodeData(items), ...dramaNodes],
        connections: canvasConnections,
        selectedNodeIds: infiniteSelectedIds,
        viewport: infiniteViewport,
      };
    }, [
      useInfiniteCanvas,
      assistantSnapshot,
      items,
      dramaNodes,
      canvasConnections,
      infiniteSelectedIds,
      infiniteViewport,
    ]);

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
      const currentNodes = [...canvasItemsToNodeData(items), ...dramaNodes];
      const currentConnections = canvasConnections;
      const snapshot: CanvasAgentSnapshot = {
        projectId: assistantSnapshot?.projectId ?? "",
        title: assistantSnapshot?.title ?? "AIMarket Canvas",
        nodes: currentNodes,
        connections: currentConnections,
        selectedNodeIds: infiniteSelectedIds,
        viewport: infiniteViewport,
      };

      const externalOps = ops.filter(isExternalAgentOp);
      const canvasOps = ops.filter(isCanvasStateOp);

      for (const op of externalOps) {
        onAgentExternalAction?.(op as AgentExternalAction);
      }

      const newSnapshot = applyCanvasAgentOps(snapshot, canvasOps);

      applyingAssistantOpsRef.current = true;

      const mergedItems = mergeSnapshotToCanvasItems(items, newSnapshot.nodes);
      const itemsChanged =
        mergedItems.length !== items.length ||
        mergedItems.some((item, index) => item !== items[index]);
      if (itemsChanged) {
        pushHistory(mergedItems);
        onItemsChange(mergedItems);
      }

      const dramaOps = extractDramaCanvasOps(canvasOps);
      if (dramaOps.length > 0) {
        onApplyAssistantOps?.(dramaOps);
      }

      const persistedConnections = extractPersistedConnections(
        newSnapshot.connections,
        mergedItems,
      );
      const connectionsChanged =
        persistedConnections.length !== infiniteConnections.length ||
        persistedConnections.some((conn, index) => conn !== infiniteConnections[index]);
      if (connectionsChanged) {
        onInfiniteConnectionsChange?.(persistedConnections);
      }

      setInfiniteSelectedIds(newSnapshot.selectedNodeIds);
      setInfiniteViewport(newSnapshot.viewport);

      setTimeout(() => {
        applyingAssistantOpsRef.current = false;
      }, 0);

      return newSnapshot;
    }, [
      items,
      dramaNodes,
      canvasConnections,
      infiniteConnections,
      assistantSnapshot,
      infiniteSelectedIds,
      infiniteViewport,
      onItemsChange,
      onApplyAssistantOps,
      onAgentExternalAction,
      onInfiniteConnectionsChange,
      pushHistory,
    ]);

    const commitCanvasOps = useCallback(
      (ops: CanvasAgentOp[]) => {
        if (readOnly || ops.length === 0) return;
        handleApplyAssistantOps(ops);
      },
      [readOnly, handleApplyAssistantOps],
    );

    const handleCreateNodeAt = useCallback(
      (nodeType: CanvasNodeType, worldX: number, worldY: number) => {
        commitCanvasOps([buildAddNodeOp(nodeType, worldX, worldY)]);
      },
      [commitCanvasOps],
    );

    const handleCreateDownstreamNode = useCallback(
      (sourceNodeId: string, nodeType: CanvasNodeType) => {
        const source = allCanvasNodesRef.current.find((n) => n.id === sourceNodeId);
        if (!source) return;
        const gap = 80;
        const addOp = buildAddNodeOp(
          nodeType,
          source.position.x + source.width + gap,
          source.position.y,
        );
        const newNodeId =
          addOp.type === "add_node" && addOp.id ? addOp.id : null;
        if (!newNodeId) return;
        commitCanvasOps([
          addOp,
          { type: "connect_nodes", fromNodeId: sourceNodeId, toNodeId: newNodeId },
        ]);
        setConnectionCreateMenu(null);
      },
      [commitCanvasOps],
    );

    const handleDeleteInfiniteNodes = useCallback(
      (nodeIds: string[]) => {
        if (readOnly || nodeIds.length === 0) return;
        commitCanvasOps([{ type: "delete_node", ids: nodeIds }]);
        setInfiniteContextMenu(null);
        setInfiniteSelectedIds((prev) => prev.filter((id) => !nodeIds.includes(id)));
        if (selectedId && nodeIds.includes(selectedId)) {
          onSelect(null);
        }
      },
      [readOnly, commitCanvasOps, selectedId, onSelect],
    );

    const handleDeleteConnection = useCallback(
      (connectionId: string) => {
        if (readOnly) return;
        const { itemPatches, ops } = buildDeleteConnectionOps(
          connectionId,
          items,
          infiniteConnections,
          dramaConnections,
        );
        if (itemPatches) {
          pushHistory(itemPatches);
          onItemsChange(itemPatches);
        }
        if (ops.length > 0) {
          commitCanvasOps(ops);
        }
        setConnectionContextMenu(null);
      },
      [
        readOnly,
        items,
        infiniteConnections,
        dramaConnections,
        pushHistory,
        onItemsChange,
        commitCanvasOps,
      ],
    );

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
          if (readOnly) return;
          e.preventDefault();
          if (useInfiniteCanvas && infiniteSelectedIds.length > 0) {
            handleDeleteInfiniteNodes(infiniteSelectedIds);
            return;
          }
          if (!selectedId) return;
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
      useInfiniteCanvas,
      infiniteSelectedIds,
      handleDeleteInfiniteNodes,
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

    // 根据节点查找对应的 CanvasItem（仅对 Image/Video 节点有意义）
    const contextMenuForItem = useCallback(
      (node: CanvasNodeData) => {
        if (node.type === CanvasNodeType.Image || node.type === CanvasNodeType.Video) {
          return items.find((i) => i.id === node.id) ?? null;
        }
        return null;
      },
      [items],
    );

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
            {dramaPhaseSplitEnabled && onDramaViewPhaseChange ? (
              <button
                type="button"
                data-testid="drama-view-phase-toggle"
                onClick={() =>
                  onDramaViewPhaseChange(toggleDramaStudioViewPhase(dramaViewPhase))
                }
                className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-200 transition hover:bg-violet-500/20"
              >
                {dramaViewPhase === "agent" ? (
                  <>
                    <Network className="size-3.5" />
                    <span>节点视图</span>
                  </>
                ) : (
                  <>
                    <MessageCircle className="size-3.5" />
                    <span>对话视图</span>
                  </>
                )}
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

          {useInfiniteCanvas ? (
            <div
              ref={infiniteCanvasAreaRef}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              data-testid="infinite-canvas-pane"
            >
              <div className="relative flex min-h-0 flex-1">
                <div className="relative min-h-0 flex-1">
                  {showInfiniteJobOverlay || jobFailed ? (
                    <CanvasJobOverlay
                      status={jobStreamStatus ?? null}
                      failed={jobFailed}
                      errorMessage={jobErrorMessage}
                      onOpenChat={onOpenChatPanel}
                      onCancel={onCancelJob}
                      onDismiss={jobFailed ? onDismissJobFailure : undefined}
                      completed={jobProgressCompleted}
                      total={jobProgressTotal}
                      elapsedMs={jobElapsedMs}
                      queueAhead={queueAhead}
                    />
                  ) : null}
                  <InfiniteCanvasContainer
                    nodes={enrichNodesWithBatchIndex([...canvasItemsToNodeData(items), ...dramaNodes])}
                    connections={canvasConnections}
                    viewport={infiniteViewport}
                    selectedNodeIds={infiniteSelectedIds}
                    onNodesChange={(nodes: CanvasNodeData[]) => {
                      if (applyingAssistantOpsRef.current) return;
                      const itemNodes = nodes.filter((n) => !isDramaNodeId(n.id));
                      onItemsChange(applyNodePositionsToItems(items, itemNodes));
                      if (onDramaNodePositionsChange) {
                        const next = { ...dramaNodePositions };
                        let changed = false;
                        for (const node of nodes) {
                          if (!isDramaNodeId(node.id)) continue;
                          const prev = dramaNodePositions[node.id];
                          if (
                            !prev ||
                            prev.x !== node.position.x ||
                            prev.y !== node.position.y
                          ) {
                            next[node.id] = {
                              x: node.position.x,
                              y: node.position.y,
                            };
                            changed = true;
                          }
                        }
                        if (changed) onDramaNodePositionsChange(next);
                      }
                    }}
                    onConnectionsChange={(nextConnections) => {
                      if (applyingAssistantOpsRef.current || readOnly) return;
                      onInfiniteConnectionsChange?.(
                        extractPersistedConnections(nextConnections, items),
                      );
                    }}
                    onViewportChange={setInfiniteViewport}
                    onSelectionChange={setInfiniteSelectedIds}
                    onNodeDoubleClick={(nodeId: string) => {
                      onSelect(nodeId);
                      setDramaPanelNodeId(nodeId);
                    }}
                    onConnectionCreateClick={(event, nodeId) => {
                      if (readOnly) return;
                      setConnectionCreateMenu({
                        sourceNodeId: nodeId,
                        x: event.clientX,
                        y: event.clientY,
                      });
                    }}
                    onCanvasDoubleClick={(world, client) => {
                      if (readOnly) return;
                      setInfiniteContextMenu(null);
                      setConnectionContextMenu(null);
                      setConnectionCreateMenu(null);
                      setPaneCreateMenu({
                        x: client.x,
                        y: client.y,
                        worldX: world.x,
                        worldY: world.y,
                      });
                    }}
                    onContextMenu={(state: ContextMenuState | null) => {
                      if (state?.type === "node") {
                        setPaneCreateMenu(null);
                        const target = allCanvasNodesRef.current.find(
                          (n) => n.id === state.nodeId,
                        );
                        if (target) {
                          setInfiniteContextMenu({
                            node: target,
                            x: state.x,
                            y: state.y,
                          });
                        }
                      } else if (state?.type === "pane") {
                        if (readOnly) return;
                        setInfiniteContextMenu(null);
                        setConnectionContextMenu(null);
                        setPaneCreateMenu({
                          x: state.x,
                          y: state.y,
                          worldX: state.worldX,
                          worldY: state.worldY,
                        });
                      } else if (state?.type === "connection") {
                        if (readOnly) return;
                        setInfiniteContextMenu(null);
                        setPaneCreateMenu(null);
                        setConnectionContextMenu({
                          connectionId: state.connectionId,
                          x: state.x,
                          y: state.y,
                        });
                      } else {
                        setInfiniteContextMenu(null);
                        setPaneCreateMenu(null);
                        setConnectionContextMenu(null);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      if (readOnly) return;
                      const btn = e.currentTarget.getBoundingClientRect();
                      const area = infiniteCanvasAreaRef.current?.getBoundingClientRect();
                      const worldX = area
                        ? (-infiniteViewport.x + area.width / 2) / infiniteViewport.k
                        : 120;
                      const worldY = area
                        ? (-infiniteViewport.y + area.height / 2) / infiniteViewport.k
                        : 120;
                      setPaneCreateMenu({
                        x: btn.left,
                        y: btn.bottom + 4,
                        worldX,
                        worldY,
                      });
                    }}
                    className="absolute right-3 top-[6.25rem] z-20 inline-flex size-8 items-center justify-center rounded-md border transition bg-black/40 text-zinc-300 hover:bg-black/60"
                    style={{ borderColor: "rgba(255,255,255,0.15)" }}
                    aria-label="添加节点"
                    title="添加节点"
                    data-testid="node-create-toggle"
                  >
                    <Plus className="size-4" />
                  </button>
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
                  <button
                    type="button"
                    onClick={() => setShowMusicGenPanel((v) => !v)}
                    className={`absolute right-3 top-14 z-20 inline-flex size-8 items-center justify-center rounded-md border transition ${
                      showMusicGenPanel
                        ? "bg-white/20 text-white"
                        : "bg-black/40 text-zinc-300 hover:bg-black/60"
                    }`}
                    style={{ borderColor: "rgba(255,255,255,0.15)" }}
                    aria-label="AI 音乐生成"
                    title="AI 音乐生成"
                    data-testid="music-gen-toggle"
                  >
                    <Music className="size-4" />
                  </button>
                </div>
                {dramaPanelNode && (
                  <DramaPropertyPanel
                    node={dramaPanelNode}
                    onClose={() => setDramaPanelNodeId(null)}
                  />
                )}
                {effectiveAssistantSnapshot && (
                  <CanvasAssistantPanel
                    snapshot={effectiveAssistantSnapshot}
                    onApplyOps={handleApplyAssistantOps}
                    initialCollapsed
                  />
                )}
                {showTemplateManager && (
                  <TemplateManager
                    selectedNodes={templateSelectedNodes}
                    connections={templateSelectedConnections}
                    sessionId={sessionId}
                    onRunStarted={onTemplatePlanRunStarted}
                    onClose={() => setShowTemplateManager(false)}
                  />
                )}
                {showMusicGenPanel && (
                  <MusicGenPanel
                    sessionId={sessionId}
                    onClose={() => setShowMusicGenPanel(false)}
                  />
                )}
              </div>
              {infiniteOrchestrationDock ? (
                <div
                  className="shrink-0 overflow-y-auto border-t border-white/10 p-2 sm:p-3"
                  style={{ maxHeight: "42vh" }}
                  data-testid="drama-canvas-overlay"
                >
                  {alternateCanvasContent}
                  {showInfiniteOrchestrationExtra ? (
                    <div
                      data-testid="orchestration-extra-section"
                      className={alternateCanvasContent ? "mt-3" : undefined}
                    >
                      {orchestrationExtra}
                    </div>
                  ) : null}
                </div>
              ) : legacyInfiniteOrchestrationDock ? (
                <div
                  className="shrink-0 overflow-y-auto border-t border-white/10 p-2 sm:p-3"
                  style={{ maxHeight: "42vh" }}
                  data-testid="drama-canvas-overlay"
                >
                  {alternateCanvasContent}
                  {orchestrationEvent ? (
                    <section
                      data-testid="orchestration-timeline-section"
                      className={alternateCanvasContent ? "mt-3" : undefined}
                    >
                      <ScrollCanvasOrchestrationCard
                        event={orchestrationEvent}
                        actions={orchestrationActions}
                      />
                    </section>
                  ) : null}
                  {orchestrationExtra ? (
                    <div
                      data-testid="orchestration-extra-section"
                      className={
                        alternateCanvasContent || orchestrationEvent
                          ? "mt-3"
                          : undefined
                      }
                    >
                      {orchestrationExtra}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : alternateCanvasContent ? (
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

        {infiniteContextMenu ? (
          <InfiniteCanvasContextMenu
            node={infiniteContextMenu.node}
            x={infiniteContextMenu.x}
            y={infiniteContextMenu.y}
            onClose={() => setInfiniteContextMenu(null)}
            onCutout={
              onCutoutItem && contextMenuForItem(infiniteContextMenu.node)
                ? () => {
                    const item = contextMenuForItem(infiniteContextMenu.node);
                    if (item) onCutoutItem(item);
                  }
                : undefined
            }
            onExpand={
              onExpandItem && contextMenuForItem(infiniteContextMenu.node)
                ? () => {
                    const item = contextMenuForItem(infiniteContextMenu.node);
                    if (item) onExpandItem(item);
                  }
                : undefined
            }
            onRerun={
              onRerun && contextMenuForItem(infiniteContextMenu.node)
                ? () => {
                    const item = contextMenuForItem(infiniteContextMenu.node);
                    if (item) onRerun(item);
                  }
                : undefined
            }
            onDownload={() => {
              const item = contextMenuForItem(infiniteContextMenu.node);
              if (item) onDownloadItem?.(item);
              else window.open(assetUrl(infiniteContextMenu.node.metadata?.content ?? ""), "_blank");
            }}
            onDelete={() => {
              handleDeleteInfiniteNodes([infiniteContextMenu.node.id]);
            }}
            onRecompose={() => {
              // 重新合成：暂以 lightbox 重新打开当前节点
              const item = contextMenuForItem(infiniteContextMenu.node);
              if (item) {
                const idx = items.findIndex((i) => i.id === item.id);
                setLightbox({ items, index: idx >= 0 ? idx : 0 });
                onSelect(item.id);
              }
            }}
            onVideoInpaint={() => {
              setShowVideoInpaint({ node: infiniteContextMenu.node });
            }}
            onMusicGen={() => {
              setShowMusicGenPanel(true);
            }}
            onMultiCam9={() => {
              runInfiniteNodeTool("multi-cam-9", infiniteContextMenu.node);
            }}
            onMultiCam25={() => {
              runInfiniteNodeTool("multi-cam-25", infiniteContextMenu.node);
            }}
            onStoryboardEvolve={() => {
              runInfiniteNodeTool("storyboard-evolve", infiniteContextMenu.node);
            }}
            onTurnaround360={() => {
              runInfiniteNodeTool("turnaround-360", infiniteContextMenu.node);
            }}
            onLighting={() => {
              setShowLighting({ node: infiniteContextMenu.node });
            }}
            onCamera={() => {
              setShowCamera({ node: infiniteContextMenu.node });
            }}
            onEditScript={() => {
              onSelect(infiniteContextMenu.node.id);
              setDramaPanelNodeId(infiniteContextMenu.node.id);
            }}
            onEditShot={() => {
              onSelect(infiniteContextMenu.node.id);
              setDramaPanelNodeId(infiniteContextMenu.node.id);
            }}
            onEditCharacter={() => {
              onSelect(infiniteContextMenu.node.id);
              setDramaPanelNodeId(infiniteContextMenu.node.id);
            }}
            onEditScene={() => {
              onSelect(infiniteContextMenu.node.id);
              setDramaPanelNodeId(infiniteContextMenu.node.id);
            }}
            onGenerateShotImage={() => {
              console.info(
                "[infinite-canvas] 触发分镜图生成：节点",
                infiniteContextMenu.node.id,
              );
            }}
            onGenerateShotVideo={() => {
              console.info(
                "[infinite-canvas] 触发分镜视频生成：节点",
                infiniteContextMenu.node.id,
              );
            }}
            onGenerateCharacterSheet={() => {
              console.info(
                "[infinite-canvas] 触发三视图生成：节点",
                infiniteContextMenu.node.id,
              );
            }}
            onExtractKeyframe={() => {
              const item = contextMenuForItem(infiniteContextMenu.node);
              if (item && batchTools?.onExtractVideoLastFrame) {
                batchTools.onExtractVideoLastFrame(item);
              }
            }}
          />
        ) : null}

        {paneCreateMenu ? (
          <NodeCreateMenu
            x={paneCreateMenu.x}
            y={paneCreateMenu.y}
            showDramaTypes={allowDramaNodeCreate}
            onSelect={(type) =>
              handleCreateNodeAt(type, paneCreateMenu.worldX, paneCreateMenu.worldY)
            }
            onClose={() => setPaneCreateMenu(null)}
          />
        ) : null}

        {connectionCreateMenu ? (
          <ConnectionCreateMenu
            x={connectionCreateMenu.x}
            y={connectionCreateMenu.y + 4}
            onSelect={(type) =>
              handleCreateDownstreamNode(connectionCreateMenu.sourceNodeId, type)
            }
            onClose={() => setConnectionCreateMenu(null)}
          />
        ) : null}

        {connectionContextMenu ? (
          <ConnectionContextMenu
            x={connectionContextMenu.x}
            y={connectionContextMenu.y}
            onDelete={() => handleDeleteConnection(connectionContextMenu.connectionId)}
            onClose={() => setConnectionContextMenu(null)}
          />
        ) : null}

        {showVideoInpaint ? (
          <div
            className="absolute right-3 top-20 z-30 w-[420px] rounded-xl border p-3 shadow-2xl"
            style={{
              background: canvasTheme.canvas.background,
              borderColor: canvasTheme.node.stroke,
            }}
            data-testid="video-inpaint-inline-panel"
          >
            <div className="mb-2 flex items-center justify-between text-[11px]">
              <span className="font-semibold" style={{ color: canvasTheme.node.text }}>
                视频精准编辑
              </span>
              <button
                type="button"
                onClick={() => setShowVideoInpaint(null)}
                className="rounded p-0.5 text-[10px] hover:bg-white/10"
                style={{ color: canvasTheme.node.faint }}
                aria-label="关闭视频精准编辑"
              >
                关闭
              </button>
            </div>
            <VideoInpaintEditor
              videoUrl={
                contextMenuForItem(showVideoInpaint.node)?.url ??
                showVideoInpaint.node.metadata?.content ??
                undefined
              }
              submitting={videoInpaintSubmitting}
              onSubmit={(payload) => {
                if (!onRunInfiniteNodeTool) return;
                setVideoInpaintSubmitting(true);
                onRunInfiniteNodeTool({
                  toolId: "video-inpaint",
                  node: showVideoInpaint.node,
                  prompt: payload.prompt,
                  toolContext: {
                    toolId: "video-inpaint",
                    timestampSec: payload.timestampSec ?? 0,
                    masks: [
                      {
                        itemId: showVideoInpaint.node.id,
                        mode: "brush",
                        maskDataUrl: payload.maskDataUrl,
                        bbox: payload.maskBbox,
                        normalizedBbox: payload.maskNormalizedBbox,
                      },
                    ],
                  },
                });
                setVideoInpaintSubmitting(false);
                setShowVideoInpaint(null);
              }}
            />
          </div>
        ) : null}

        {showLighting ? (
          <div
            className="absolute right-3 top-20 z-30 w-[360px] rounded-xl border p-3 shadow-2xl"
            style={{
              background: canvasTheme.canvas.background,
              borderColor: canvasTheme.node.stroke,
            }}
            data-testid="lighting-inline-panel"
          >
            <div className="mb-2 flex items-center justify-between text-[11px]">
              <span className="font-semibold" style={{ color: canvasTheme.node.text }}>
                灯光控制
              </span>
              <button
                type="button"
                onClick={() => setShowLighting(null)}
                className="rounded p-0.5 text-[10px] hover:bg-white/10"
                style={{ color: canvasTheme.node.faint }}
                aria-label="关闭灯光控制"
              >
                关闭
              </button>
            </div>
            {resolveNodeImageUrl(showLighting.node) ? (
              <LightingOverlayInline
                imageUrl={resolveNodeImageUrl(showLighting.node)!}
                onApply={(sources) => {
                  runInfiniteNodeTool("lighting-control", showLighting.node, {
                    toolContext: { toolId: "lighting-control", sources },
                  });
                  setShowLighting(null);
                }}
                onClose={() => setShowLighting(null)}
              />
            ) : (
              <p className="text-[10px]" style={{ color: canvasTheme.node.faint }}>
                当前节点无可编辑图片
              </p>
            )}
          </div>
        ) : null}

        {showCamera ? (
          <div
            className="absolute right-3 top-20 z-30 w-[360px] rounded-xl border p-3 shadow-2xl"
            style={{
              background: canvasTheme.canvas.background,
              borderColor: canvasTheme.node.stroke,
            }}
            data-testid="camera-inline-panel"
          >
            <div className="mb-2 flex items-center justify-between text-[11px]">
              <span className="font-semibold" style={{ color: canvasTheme.node.text }}>
                摄像机控制
              </span>
              <button
                type="button"
                onClick={() => setShowCamera(null)}
                className="rounded p-0.5 text-[10px] hover:bg-white/10"
                style={{ color: canvasTheme.node.faint }}
                aria-label="关闭摄像机控制"
              >
                关闭
              </button>
            </div>
            <CameraOverlayInline
              node={showCamera.node}
              onApply={(params) => {
                const hasImage = Boolean(resolveNodeImageUrl(showCamera.node));
                if (hasImage) {
                  runInfiniteNodeTool("camera-control", showCamera.node, {
                    toolContext: { toolId: "camera-control", camera: params },
                  });
                } else {
                  onPatchDramaShotNode?.(showCamera.node.id, {
                    cameraShotSize: params.shotSize,
                    cameraMovement: params.movement,
                  });
                }
                setShowCamera(null);
              }}
              onClose={() => setShowCamera(null)}
            />
          </div>
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

// ---------------------------------------------------------------------------
// Phase 4 Task 4.1/4.2 浮层：灯光 / 摄像机
// 包装 LightingOverlay / CameraOverlay，让其支持关闭按钮并应用到画布节点
// ---------------------------------------------------------------------------

function LightingOverlayInline({
  imageUrl,
  onApply,
  onClose,
}: {
  imageUrl: string;
  onApply: (sources: LightSource[]) => void;
  onClose: () => void;
}) {
  const [sources, setSources] = useState<LightSource[]>([]);
  return (
    <div className="flex flex-col gap-2">
      <LightingOverlay
        imageUrl={imageUrl}
        sources={sources}
        onSourcesChange={setSources}
        className="rounded-lg"
      />
      <div className="flex items-center justify-between text-[10px]">
        <span style={{ color: canvasTheme.node.faint }}>
          光源：{sources.length} 个
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setSources([])}
            className="rounded px-2 py-0.5 transition hover:bg-white/10"
            style={{ color: canvasTheme.node.muted }}
            disabled={sources.length === 0}
          >
            清空
          </button>
          <button
            type="button"
            onClick={() => onApply(sources)}
            className="rounded px-2 py-0.5 transition hover:bg-white/10"
            style={{ color: "#a5b4fc" }}
            disabled={sources.length === 0}
          >
            应用并重生成
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-0.5 transition hover:bg-white/10"
            style={{ color: canvasTheme.node.muted }}
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

function CameraOverlayInline({
  node,
  onApply,
  onClose,
}: {
  node: CanvasNodeData;
  onApply: (params: DramaCameraParams) => void;
  onClose: () => void;
}) {
  const m = node.metadata;
  const [params, setParams] = useState<DramaCameraParams>({
    shotSize: m?.cameraShotSize,
    movement: m?.cameraMovement,
    pitch: 0,
    yaw: 0,
  });
  const hasImage = Boolean(resolveNodeImageUrl(node));
  return (
    <div className="flex flex-col gap-2">
      <CameraOverlay params={params} onChange={setParams} />
      <div className="flex justify-end gap-1 text-[10px]">
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-0.5 transition hover:bg-white/10"
          style={{ color: canvasTheme.node.muted }}
        >
          关闭
        </button>
        <button
          type="button"
          onClick={() => onApply(params)}
          className="rounded px-2 py-0.5 transition hover:bg-white/10"
          style={{ color: "#a5b4fc" }}
        >
          {hasImage ? "应用并重生成" : "保存摄影参数"}
        </button>
      </div>
    </div>
  );
}
