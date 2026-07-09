import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { Ref } from "react";
import type { CanvasItem, CanvasToolId, CanvasLayoutMode } from "@/lib/canvas-tools";
import {
  canShowRefineCompare,
  collectRefineChainItems,
  isSingleOutputRefineResult,
  pickLatestBatchId,
  REFINE_SINGLE_OUTPUT_TOOL_IDS,
} from "@/lib/canvas-tools";
import { resolveIsDramaWorkflowInfiniteView } from "@/lib/studio-canvas-view";
import { WORKFLOW_AGENT_PANEL } from "@/lib/workflow-shell";
import { useResizablePanelWidth } from "@/hooks/use-resizable-panel-width";
import type { ProductGalleryHandle } from "@/components/product-gallery";
import type { FreeCanvasHandle } from "@/components/free-canvas";
import { MOBILE_BREAKPOINT } from "@/lib/breakpoints";
import { hapticLight } from "@/lib/haptics";
import { assetUrl } from "@/lib/api-client";
import type { InfiniteNodeToolRequest } from "@/lib/infinite-node-tool-run";
import { resolveNodeImageUrl, resolveNodeToolPrompt } from "@/lib/infinite-node-tool-run";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { InfiniteNodeStudioDock } from "@/components/infinite-canvas/InfiniteNodeStudioDock";
import { buildCanvasNodeToolbarActions } from "@/lib/canvas-node-toolbar-actions";
import { useInfiniteNodeMenuHandlers } from "@/hooks/use-infinite-node-menu-handlers";
import {
  canvasItemsToNodeData,
  mergeCanvasConnections,
  applyNodePositionsToItems,
} from "@/components/infinite-canvas/migration";
import type { CanvasNodeData, CanvasConnection, ViewportTransform, ContextMenuState } from "@/components/infinite-canvas/types";
import { CanvasNodeType } from "@/components/infinite-canvas/types";
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
  type CanvasAgentSnapshot,
  type CanvasAgentOp,
  type AgentExternalAction,
} from "@/components/infinite-canvas/utils";
import type { DesignCanvasHandle, DesignCanvasProps } from "@/components/design-canvas-types";
import {
  bindRunGenerationNodeIds,
  collectRunGenerationRequests,
} from "@/lib/agent-run-generation";

export function useDesignCanvas(props: DesignCanvasProps, ref: Ref<DesignCanvasHandle>) {
  const {
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
      nodeActions,
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
      useInfiniteCanvas = false,
      conversationPaneEnabled = false,
      onConversationPaneActiveChange,
      conversationPaneWidth,
      onConversationPaneResizeStart,
      conversationPaneResizing = false,
      overlayBottomInsetPx = 0,
      canvasViewEnabled = false,
      dramaPhaseSplitEnabled = false,
      dramaViewPhase = "agent",
      onDramaViewPhaseChange,
      onInfiniteCanvasActiveChange,
      infiniteEmptyCreation,
      dramaNodes = [],
      dramaConnections = [],
      assistantSnapshot,
      onApplyAssistantOps,
      onAgentExternalAction,
      allowDramaNodeCreate = false,
      sessionId,
      onPatchDramaShotNode,
      onTemplatePlanRunStarted,
      workflowShell = false,
    } = props;
    const onCutoutItem = nodeActions?.onCutoutItem;
    const onExpandItem = nodeActions?.onExpandItem;
    const onRerun = nodeActions?.onRerun;
    const onDownloadItem = nodeActions?.onDownloadItem;
    const onShareItem = nodeActions?.onShareItem;
    const onPublishItem = nodeActions?.onPublishItem;
    const batchTools = nodeActions?.batchTools;
    const onRunInfiniteNodeTool = nodeActions?.onRunInfiniteNodeTool;
    const onAgentRunGeneration = nodeActions?.onAgentRunGeneration;
    const dramaNodeActions = nodeActions?.drama;

    const scrollCanvasRef = useRef<ProductGalleryHandle>(null);
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

    // 短剧 workflow Infinite：侧栏 Drama/Assistant + orchestration dock（见 studio-canvas-view）
    const isDramaWorkflowInfiniteView = resolveIsDramaWorkflowInfiniteView({
      useInfiniteCanvas,
      dramaPhaseSplitEnabled,
      viewPhase: dramaViewPhase,
    });

    const showLegacyInfiniteOrchestration =
      useInfiniteCanvas &&
      !dramaPhaseSplitEnabled &&
      Boolean(orchestrationEvent);

    const infiniteOrchestrationDock =
      isDramaWorkflowInfiniteView && Boolean(alternateCanvasContent);
    const legacyInfiniteOrchestrationDock =
      showLegacyInfiniteOrchestration &&
      (Boolean(alternateCanvasContent) ||
        Boolean(orchestrationEvent) ||
        Boolean(orchestrationExtra));

    useEffect(() => {
      onInfiniteCanvasActiveChange?.(Boolean(useInfiniteCanvas));
    }, [useInfiniteCanvas, onInfiniteCanvasActiveChange]);

    const activeInfiniteStudioNodeId = useMemo(() => {
      if (!isDramaWorkflowInfiniteView || infiniteSelectedIds.length !== 1) return null;
      return infiniteSelectedIds[0] ?? null;
    }, [isDramaWorkflowInfiniteView, infiniteSelectedIds]);

    useEffect(() => {
      if (!isDramaWorkflowInfiniteView) return;
      setDramaPanelNodeId(activeInfiniteStudioNodeId);
    }, [activeInfiniteStudioNodeId, isDramaWorkflowInfiniteView]);

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
    const {
      width: agentPanelWidth,
      dragging: agentPanelDragging,
      onResizeStart: onAgentPanelResizeStart,
    } = useResizablePanelWidth({
      storageKey: WORKFLOW_AGENT_PANEL.storageKey,
      defaultWidth: WORKFLOW_AGENT_PANEL.defaultWidth,
      minWidth: WORKFLOW_AGENT_PANEL.minWidth,
      maxWidth: WORKFLOW_AGENT_PANEL.maxWidth,
    });
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
      const boundOps = bindRunGenerationNodeIds(ops);
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

      const externalOps = boundOps.filter(isExternalAgentOp);
      const canvasOps = boundOps.filter(isCanvasStateOp);

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
      if (newSnapshot.selectedNodeIds.length === 1) {
        onSelect(newSnapshot.selectedNodeIds[0] ?? null);
      } else if (newSnapshot.selectedNodeIds.length === 0) {
        onSelect(null);
      }
      setInfiniteViewport(newSnapshot.viewport);

      setTimeout(() => {
        applyingAssistantOpsRef.current = false;
      }, 0);

      if (!readOnly && onAgentRunGeneration) {
        const requests = collectRunGenerationRequests(newSnapshot.nodes, boundOps);
        for (const req of requests) {
          void onAgentRunGeneration(req);
        }
      }

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
      onAgentRunGeneration,
      readOnly,
      pushHistory,
      onSelect,
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

    /** 双栏（左对话 + 右产物）是否实际渲染：仅 agent 车道 + 桌面 + scroll 视图 */
    const conversationPaneActive =
      conversationPaneEnabled &&
      !mobile &&
      !useInfiniteCanvas &&
      !alternateCanvasContent &&
      !showFreeCanvas;

    useEffect(() => {
      onConversationPaneActiveChange?.(conversationPaneActive);
    }, [conversationPaneActive, onConversationPaneActiveChange]);

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

    const getInfiniteNodeMenuHandlers = useInfiniteNodeMenuHandlers({
      items,
      onCutoutItem,
      onExpandItem,
      onRerun,
      onDownloadItem:
        onDownloadItem ??
        ((item: CanvasItem) => window.open(assetUrl(item.url), "_blank")),
      onDeleteNodes: handleDeleteInfiniteNodes,
      onSelect,
      onOpenLightbox: (canvasItems, index) => setLightbox({ items: canvasItems, index }),
      onVideoInpaint: (node) => setShowVideoInpaint({ node }),
      onOpenLighting: (node) => setShowLighting({ node }),
      onOpenCamera: (node) => setShowCamera({ node }),
      onMusicGen: () => setShowMusicGenPanel(true),
      onRunInfiniteNodeTool: runInfiniteNodeTool,
      onEditDramaNode: (nodeId) => {
        onSelect(nodeId);
        setDramaPanelNodeId(nodeId);
      },
      onExtractVideoLastFrame: batchTools?.onExtractVideoLastFrame,
      onGenerateShotImage: dramaNodeActions?.onGenerateShotImage,
      onGenerateShotVideo: dramaNodeActions?.onGenerateShotVideo,
      onGenerateCharacterSheet: dramaNodeActions?.onGenerateCharacterSheet,
      onGenerateShotsFromScript: dramaNodeActions?.onGenerateShotsFromScript,
    });

    const handleInfiniteSelectionChange = useCallback(
      (ids: string[]) => {
        setInfiniteSelectedIds(ids);
        if (ids.length === 1) {
          onSelect(ids[0] ?? null);
        } else if (ids.length === 0) {
          onSelect(null);
        }
      },
      [onSelect],
    );

    const renderInfiniteNodeStudioPanel = useCallback(
      (node: CanvasNodeData) => {
        if (!useInfiniteCanvas) return null;
        const snapshot: CanvasAgentSnapshot = {
          projectId: assistantSnapshot?.projectId ?? "",
          title: assistantSnapshot?.title ?? "AIMarket Canvas",
          nodes: [...canvasItemsToNodeData(items), ...dramaNodes],
          connections: canvasConnections,
          selectedNodeIds: [node.id],
          viewport: infiniteViewport,
        };
        const item = contextMenuForItem(node);
        const toolActions = buildCanvasNodeToolbarActions({
          node,
          handlers: getInfiniteNodeMenuHandlers(node),
          item,
          tools: batchTools?.tools,
          pendingToolId: batchTools?.pendingToolId,
          onRunTool: batchTools?.onRunTool,
        });
        return (
          <InfiniteNodeStudioDock
            node={node}
            snapshot={snapshot}
            onApplyOps={handleApplyAssistantOps}
            readOnly={readOnly}
            toolActions={toolActions}
            onClose={() => {
              setInfiniteSelectedIds([]);
              onSelect(null);
            }}
          />
        );
      },
      [
        useInfiniteCanvas,
        assistantSnapshot,
        items,
        dramaNodes,
        canvasConnections,
        infiniteViewport,
        handleApplyAssistantOps,
        readOnly,
        onSelect,
        getInfiniteNodeMenuHandlers,
        contextMenuForItem,
        batchTools,
      ],
    );

    const showInfiniteEmptyPrompt =
      useInfiniteCanvas &&
      items.length === 0 &&
      dramaNodes.length === 0 &&
      Boolean(infiniteEmptyCreation);

    const openInfiniteCenterCreateMenu = useCallback(() => {
      const area = infiniteCanvasAreaRef.current?.getBoundingClientRect();
      if (!area) return;
      const worldX = (-infiniteViewport.x + area.width / 2) / infiniteViewport.k;
      const worldY = (-infiniteViewport.y + area.height / 2) / infiniteViewport.k;
      setPaneCreateMenu({
        x: area.left + area.width / 2,
        y: area.top + area.height / 2,
        worldX,
        worldY,
      });
    }, [infiniteViewport]);

    const handleNodeCreateToggleClick = useCallback(
      (anchor: DOMRect) => {
        if (readOnly) return;
        const area = infiniteCanvasAreaRef.current?.getBoundingClientRect();
        const worldX = area
          ? (-infiniteViewport.x + area.width / 2) / infiniteViewport.k
          : 120;
        const worldY = area
          ? (-infiniteViewport.y + area.height / 2) / infiniteViewport.k
          : 120;
        setPaneCreateMenu({
          x: anchor.left,
          y: anchor.bottom + 4,
          worldX,
          worldY,
        });
      },
      [infiniteViewport, readOnly],
    );

    const comparePair = useMemo(() => {
      if (!refineRootItemId || !refineItemId) return null;
      return canShowRefineCompare(items, refineRootItemId, refineItemId);
    }, [items, refineRootItemId, refineItemId]);

    const compareAvailable = Boolean(comparePair);

    /** 产物区（ProductGallery）公共 props，供单列 / 双栏两处复用 */
    const productGalleryProps = {
      items,
      batchSections,
      selectedId,
      onSelect,
      readOnly,
      emptyHint,
      pulseId,
      onEnterRefineMode: enterRefineMode,
      onSetLightbox: setLightbox,
      onDeleteSelected,
      onRerun: (item: CanvasItem) => onRerun?.(item),
      onJumpToParentBatch,
      jobStreamStatus,
      jobFailed,
      jobErrorMessage,
      jobProgressCompleted,
      jobProgressTotal,
      onOpenChatPanel,
      onCancelJob,
      onDismissJobFailure,
      jobElapsedMs,
      queueAhead,
      pendingJobPrompt,
      jobStartedAt,
      focusClickActive,
      focusItem: focusItem ?? null,
      onFocusImageClick,
      scrollBottomInset,
      batchTools,
      onDownloadItem:
        onDownloadItem ??
        ((item: CanvasItem) => window.open(assetUrl(item.url), "_blank")),
      onShareItem,
      onPublishItem,
    };

  return {
    mobile,
    showFreeCanvas,
    tool,
    gridOn,
    handleTool,
    canUndo,
    canRedo,
    selectSourceBanner,
    showFailureBannerDismiss,
    onDismissJobFailure,
    isRefineMode,
    exitRefineMode,
    refineCompleteNotice,
    compareAvailable,
    compareMode,
    setCompareMode,
    canvasViewEnabled,
    dramaViewPhase,
    onDramaViewPhaseChange,
    focusClickActive,
    focusClickRequest,
    onFocusClickCancel,
    useInfiniteCanvas,
    items,
    selectedId,
    onSelect,
    readOnly,
    infiniteCanvasAreaRef,
    allCanvasNodes,
    canvasConnections,
    infiniteViewport,
    setInfiniteViewport,
    infiniteSelectedIds,
    overlayBottomInsetPx,
    showInfiniteJobOverlay,
    jobFailed,
    jobStreamStatus,
    jobErrorMessage,
    jobProgressCompleted,
    jobProgressTotal,
    jobElapsedMs,
    queueAhead,
    onOpenChatPanel,
    onCancelJob,
    renderInfiniteNodeStudioPanel,
    applyingAssistantOpsRef,
    onItemsChange,
    dramaNodePositions,
    onDramaNodePositionsChange,
    onInfiniteConnectionsChange,
    handleInfiniteSelectionChange,
    setDramaPanelNodeId,
    setConnectionCreateMenu,
    setInfiniteContextMenu,
    setConnectionContextMenu,
    setPaneCreateMenu,
    allCanvasNodesRef,
    showInfiniteEmptyPrompt,
    infiniteEmptyCreation,
    openInfiniteCenterCreateMenu,
    handleNodeCreateToggleClick,
    showTemplateManager,
    setShowTemplateManager,
    showMusicGenPanel,
    setShowMusicGenPanel,
    dramaPanelNode,
    isDramaWorkflowInfiniteView,
    effectiveAssistantSnapshot,
    handleApplyAssistantOps,
    templateSelectedNodes,
    templateSelectedConnections,
    sessionId,
    onTemplatePlanRunStarted,
    infiniteOrchestrationDock,
    legacyInfiniteOrchestrationDock,
    alternateCanvasContent,
    orchestrationEvent,
    orchestrationActions,
    orchestrationExtra,
    scrollBottomInset,
    freeCanvasRef,
    batchSections,
    handleItemsChangeWithHistory,
    emptyHint,
    pulseId,
    refineItemId,
    refineRootItemId,
    refineChain,
    selectRefineTarget,
    comparePair,
    setLightbox,
    setContextMenu,
    onJumpToParentBatch,
    onDeleteSelected,
    onRerun,
    setTool,
    brushRequest,
    onBrushComplete,
    onBrushCancel,
    expandRequest,
    onExpandComplete,
    onExpandCancel,
    onFocusImageClick,
    selectionToolbar,
    statusChip,
    scrollCanvasRef,
    productGalleryProps,
    conversationPaneActive,
    conversationPaneWidth,
    onConversationPaneResizeStart,
    conversationPaneResizing,
    contextMenu,
    onDownload,
    onCutoutItem,
    onExpandItem,
    infiniteContextMenu,
    getInfiniteNodeMenuHandlers,
    paneCreateMenu,
    allowDramaNodeCreate,
    handleCreateNodeAt,
    connectionCreateMenu,
    handleCreateDownstreamNode,
    connectionContextMenu,
    handleDeleteConnection,
    showVideoInpaint,
    setShowVideoInpaint,
    videoInpaintSubmitting,
    onRunInfiniteNodeTool,
    contextMenuForItem,
    showLighting,
    setShowLighting,
    runInfiniteNodeTool,
    showCamera,
    setShowCamera,
    onPatchDramaShotNode,
    lightbox,
    enterRefineMode,
    setVideoInpaintSubmitting,
    workflowShell,
    agentPanelWidth,
    agentPanelDragging,
    onAgentPanelResizeStart,
  };}

export type DesignCanvasViewModel = ReturnType<typeof useDesignCanvas>;
