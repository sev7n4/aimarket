"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { panDeltaFromKey, zoomFactorFromKey } from "@/lib/canvas-nav";
import {
  filterMediaFiles,
} from "@/lib/canvas-media-drop";
import {
  isSessionAssetDrag,
  readSessionAssetId,
} from "@/lib/canvas-asset-drag";
import {
  connectionDropIntent,
  resolveConnectionEndpoints,
  validateConnectionEndpoints,
  canConnectNodes,
} from "@/lib/canvas-connection-ux";
import { canvasTheme, type CanvasBackgroundMode } from "./canvas-theme";
import { CanvasChromeBar } from "./CanvasChromeBar";
import { CanvasGuideCapsule } from "./CanvasGuideCapsule";
import { infiniteLeftChromeBottom } from "./infinite-canvas-layout";
import { InfiniteCanvas } from "./InfiniteCanvas";
import { CanvasNode } from "./CanvasNode";
import { ConnectionPath, ActiveConnectionPath, getConnectionPathGeometry } from "./CanvasConnections";
import { ConnectionScissors } from "./ConnectionScissors";
import { CanvasMiniMap } from "./CanvasMiniMap";
import { CanvasZoomControls } from "./CanvasZoomControls";
import { MultiSelectToolbar } from "./MultiSelectToolbar";
import type {
  CanvasNodeData,
  CanvasConnection,
  ConnectionHandle,
  ContextMenuState,
  Position,
  SelectionBox,
  ViewportTransform,
} from "./types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type InfiniteCanvasContainerProps = {
  nodes: CanvasNodeData[];
  connections: CanvasConnection[];
  viewport: ViewportTransform;
  selectedNodeIds: string[];
  selectedConnectionId?: string | null;
  onSelectedConnectionChange?: (connectionId: string | null) => void;
  onDeleteConnection?: (connectionId: string) => void;
  onTitleChange?: (nodeId: string, title: string) => void;
  onNodesChange: (nodes: CanvasNodeData[]) => void;
  onConnectionsChange: (connections: CanvasConnection[]) => void;
  onViewportChange: (viewport: ViewportTransform) => void;
  onSelectionChange: (ids: string[]) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  onConnectionCreateClick?: (
    event: React.MouseEvent,
    nodeId: string,
    world: Position,
  ) => void;
  onConnectionDropAtEmpty?: (
    params: {
      fromNodeId: string;
      handleType: "source" | "target";
      world: Position;
      client: { x: number; y: number };
    },
  ) => void;
  onCanvasDoubleClick?: (world: Position, client: { x: number; y: number }) => void;
  onContextMenu?: (state: ContextMenuState | null) => void;
  renderNodeContent?: (node: CanvasNodeData) => ReactNode;
  renderPanel?: (node: CanvasNodeData) => ReactNode;
  backgroundMode?: CanvasBackgroundMode;
  showMiniMap?: boolean;
  showZoomControls?: boolean;
  /** 左下角控件需额外抬高的像素（避开 StudioDock） */
  overlayBottomInsetPx?: number;
  /** 工作流壳层：为 true 时显示左下 guide + chrome */
  workflowShell?: boolean;
  readOnly?: boolean;
  /** 拖入/粘贴媒体文件时在落点上传并创建节点 */
  onMediaUploadAt?: (files: File[], world: Position) => void;
  /** 从资产面板拖入会话资产时在落点克隆节点 */
  onAssetDropAt?: (itemId: string, world: Position) => void;
  multiSelectActions?: {
    onGroup: () => void;
    onLayout: () => void;
    onDownload: () => void;
    onDelete: () => void;
    onBatchConnect: (targetNodeId: string) => void;
  };
  multiSelectNotice?: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SNAP_GRID = 48;

function snapToGrid(value: number, grid: number = SNAP_GRID): number {
  return Math.round(value / grid) * grid;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return true;
  }
  return target.isContentEditable;
}

function generateConnectionId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function isPointNearNode(
  worldX: number,
  worldY: number,
  node: CanvasNodeData,
  margin: number = 40,
): boolean {
  return (
    worldX >= node.position.x - margin &&
    worldX <= node.position.x + node.width + margin &&
    worldY >= node.position.y - margin &&
    worldY <= node.position.y + node.height + margin
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InfiniteCanvasContainer({
  nodes,
  connections,
  viewport,
  selectedNodeIds,
  selectedConnectionId: selectedConnectionIdProp = null,
  onSelectedConnectionChange,
  onDeleteConnection,
  onTitleChange,
  onNodesChange,
  onConnectionsChange,
  onViewportChange,
  onSelectionChange,
  onNodeDoubleClick,
  onConnectionCreateClick,
  onConnectionDropAtEmpty,
  onCanvasDoubleClick,
  onContextMenu: onContextMenuProp,
  renderNodeContent,
  renderPanel,
  backgroundMode = "lines",
  showMiniMap: showMiniMapProp,
  showZoomControls: showZoomControlsProp,
  overlayBottomInsetPx = 0,
  workflowShell = false,
  readOnly = false,
  onMediaUploadAt,
  onAssetDropAt,
  multiSelectActions,
  multiSelectNotice,
}: InfiniteCanvasContainerProps) {
  // ---- local state ----
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedConnectionIdLocal, setSelectedConnectionIdLocal] = useState<
    string | null
  >(null);
  const selectedConnectionId =
    onSelectedConnectionChange !== undefined
      ? (selectedConnectionIdProp ?? null)
      : selectedConnectionIdLocal;
  const setSelectedConnectionId = useCallback(
    (connectionId: string | null) => {
      if (onSelectedConnectionChange) {
        onSelectedConnectionChange(connectionId);
      } else {
        setSelectedConnectionIdLocal(connectionId);
      }
    },
    [onSelectedConnectionChange],
  );
  const [connectingParams, setConnectingParams] =
    useState<ConnectionHandle | null>(null);
  const [connectionTargetNodeId, setConnectionTargetNodeId] = useState<
    string | null
  >(null);
  const [connectionTargetRejected, setConnectionTargetRejected] =
    useState(false);
  const [connectionRejectMessage, setConnectionRejectMessage] = useState<
    string | null
  >(null);
  const connectionRejectTimerRef = useRef<number | null>(null);
  const lastHoverRejectReasonRef = useRef<string | null>(null);
  const [mouseWorld, setMouseWorld] = useState<Position>({ x: 0, y: 0 });
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [localContextMenu, setLocalContextMenu] =
    useState<ContextMenuState | null>(null);
  const [isMiniMapOpen, setIsMiniMapOpen] = useState(true);
  const [gridOn, setGridOn] = useState(true);
  const [snapOn, setSnapOn] = useState(false);
  const [edgeAnimOn, setEdgeAnimOn] = useState(true);
  const [viewLocked, setViewLocked] = useState(false);
  const [batchConnecting, setBatchConnecting] = useState(false);
  const batchConnectingRef = useRef(false);

  // ---- refs (high-frequency / global handler state) ----
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef(nodes);
  const viewportRef = useRef(viewport);
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  const connectingParamsRef = useRef<ConnectionHandle | null>(null);
  const connectionsRef = useRef(connections);

  const dragRef = useRef<{
    isDraggingNode: boolean;
    hasMoved: boolean;
    startX: number;
    startY: number;
    initialPositions: { id: string; x: number; y: number }[];
  }>({
    isDraggingNode: false,
    hasMoved: false,
    startX: 0,
    startY: 0,
    initialPositions: [],
  });

  const selectionBoxRef = useRef<SelectionBox | null>(null);
  const snapOnRef = useRef(snapOn);
  const viewLockedRef = useRef(viewLocked);

  const rafRef = useRef<number | null>(null);
  const nextNodesRef = useRef<CanvasNodeData[] | null>(null);

  // ---- keep refs in sync ----
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);
  useEffect(() => {
    selectedNodeIdsRef.current = selectedNodeIds;
  }, [selectedNodeIds]);
  useEffect(() => {
    connectingParamsRef.current = connectingParams;
  }, [connectingParams]);
  useEffect(() => {
    connectionsRef.current = connections;
  }, [connections]);
  useEffect(() => {
    snapOnRef.current = snapOn;
  }, [snapOn]);
  useEffect(() => {
    viewLockedRef.current = viewLocked;
  }, [viewLocked]);
  useEffect(() => {
    batchConnectingRef.current = batchConnecting;
  }, [batchConnecting]);

  const guardedViewportChange = useCallback(
    (next: ViewportTransform) => {
      if (viewLockedRef.current) return;
      onViewportChange(next);
    },
    [onViewportChange],
  );

  // ---- derived ----
  const showMiniMap = showMiniMapProp !== false && isMiniMapOpen;

  // ---- coordinate helpers ----
  const screenToCanvas = useCallback(
    (clientX: number, clientY: number): Position => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - viewport.x) / viewport.k,
        y: (clientY - rect.top - viewport.y) / viewport.k,
      };
    },
    [viewport.x, viewport.y, viewport.k],
  );

  // ---- viewport helpers ----
  const resetViewport = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    guardedViewportChange({
      x: rect.width / 2,
      y: rect.height / 2,
      k: 1,
    });
  }, [guardedViewportChange]);

  const setZoomScale = useCallback(
    (scale: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const vp = viewportRef.current;
      const worldX = (centerX - vp.x) / vp.k;
      const worldY = (centerY - vp.y) / vp.k;
      guardedViewportChange({
        x: centerX - worldX * scale,
        y: centerY - worldY * scale,
        k: scale,
      });
    },
    [guardedViewportChange],
  );

  const zoomByFactor = useCallback(
    (factor: number) => {
      const vp = viewportRef.current;
      const nextScale = Math.min(Math.max(vp.k * factor, 0.05), 5);
      setZoomScale(nextScale);
    },
    [setZoomScale],
  );

  // ---- deselect all ----
  const deselectAll = useCallback(() => {
    onSelectionChange([]);
    setSelectedConnectionId(null);
    setLocalContextMenu(null);
  }, [onSelectionChange, setSelectedConnectionId]);

  // ---- node mouse down (drag + selection) ----
  const handleNodeMouseDown = useCallback(
    (event: React.MouseEvent, nodeId: string) => {
      event.stopPropagation();

      setSelectedConnectionId(null);

      // Update selection
      const isAdditive = event.shiftKey || event.ctrlKey || event.metaKey;
      if (isAdditive) {
        const current = selectedNodeIdsRef.current;
        if (current.includes(nodeId)) {
          onSelectionChange(current.filter((id) => id !== nodeId));
        } else {
          onSelectionChange([...current, nodeId]);
        }
      } else {
        if (!selectedNodeIdsRef.current.includes(nodeId)) {
          onSelectionChange([nodeId]);
        }
      }

      // Start drag
      const currentSelected = isAdditive
        ? selectedNodeIdsRef.current.includes(nodeId)
          ? selectedNodeIdsRef.current
          : [...selectedNodeIdsRef.current, nodeId]
        : [nodeId];

      dragRef.current = {
        isDraggingNode: true,
        hasMoved: false,
        startX: event.clientX,
        startY: event.clientY,
        initialPositions: currentSelected
          .map((id) => {
            const n = nodesRef.current.find((node) => node.id === id);
            return n
              ? { id: n.id, x: n.position.x, y: n.position.y }
              : null;
          })
          .filter(Boolean) as { id: string; x: number; y: number }[],
      };
    },
    [onSelectionChange, setSelectedConnectionId],
  );

  const showRejectReason = useCallback((reason: string) => {
    if (lastHoverRejectReasonRef.current === reason) return;
    lastHoverRejectReasonRef.current = reason;
    setConnectionRejectMessage(reason);
    if (connectionRejectTimerRef.current !== null) {
      window.clearTimeout(connectionRejectTimerRef.current);
    }
    connectionRejectTimerRef.current = window.setTimeout(() => {
      setConnectionRejectMessage(null);
      connectionRejectTimerRef.current = null;
    }, 2200);
  }, []);

  const clearConnectionRejectFeedback = useCallback(() => {
    lastHoverRejectReasonRef.current = null;
    setConnectionRejectMessage(null);
    if (connectionRejectTimerRef.current !== null) {
      window.clearTimeout(connectionRejectTimerRef.current);
      connectionRejectTimerRef.current = null;
    }
  }, []);

  const findDropTargetAtWorld = useCallback(
    (worldX: number, worldY: number, excludeNodeId: string) => {
      for (const node of nodesRef.current) {
        if (node.id === excludeNodeId) continue;
        if (isPointNearNode(worldX, worldY, node)) {
          return node;
        }
      }
      return null;
    },
    [],
  );

  const findBatchDropTargetAtWorld = useCallback(
    (worldX: number, worldY: number, excludeIds: Set<string>) => {
      for (const node of nodesRef.current) {
        if (excludeIds.has(node.id)) continue;
        if (isPointNearNode(worldX, worldY, node)) {
          return node;
        }
      }
      return null;
    },
    [],
  );

  const evaluateBatchConnectionTarget = useCallback(
    (sourceIds: string[], targetNode: CanvasNodeData): { ok: boolean; reason?: string } => {
      const sources = sourceIds
        .map((id) => nodesRef.current.find((n) => n.id === id))
        .filter(Boolean) as CanvasNodeData[];
      if (sources.length === 0) return { ok: false, reason: "无有效源节点" };
      const anyValid = sources.some(
        (source) => canConnectNodes(source, targetNode).ok,
      );
      if (!anyValid) {
        return { ok: false, reason: "选中节点均无法连入目标" };
      }
      return { ok: true };
    },
    [],
  );

  const evaluateConnectionTarget = useCallback(
    (
      params: ConnectionHandle,
      targetNode: CanvasNodeData,
    ): { ok: boolean; reason?: string } => {
      const originNode = nodesRef.current.find((n) => n.id === params.nodeId);
      if (!originNode) return { ok: false, reason: "源节点不存在" };
      const { fromNodeId, toNodeId } = resolveConnectionEndpoints(
        params.nodeId,
        params.handleType,
        targetNode.id,
      );
      const fromNode =
        fromNodeId === originNode.id ? originNode : targetNode;
      const toNode = toNodeId === originNode.id ? originNode : targetNode;
      return validateConnectionEndpoints(fromNode, toNode);
    },
    [],
  );

  // ---- connection start ----
  const handleConnectStart = useCallback(
    (event: React.MouseEvent, nodeId: string, handleType: "source" | "target") => {
      event.stopPropagation();
      event.preventDefault();
      const params: ConnectionHandle = { nodeId, handleType };
      setConnectingParams(params);
      connectingParamsRef.current = params;
      setConnectionTargetNodeId(null);
      setConnectionTargetRejected(false);
      clearConnectionRejectFeedback();

      const world = screenToCanvas(event.clientX, event.clientY);
      setMouseWorld(world);
    },
    [screenToCanvas, clearConnectionRejectFeedback],
  );

  const handleBatchConnectStart = useCallback(
    (event: React.MouseEvent) => {
      if (readOnly || selectedNodeIdsRef.current.length < 2) return;
      event.stopPropagation();
      event.preventDefault();
      setBatchConnecting(true);
      batchConnectingRef.current = true;
      setConnectingParams(null);
      connectingParamsRef.current = null;
      setConnectionTargetNodeId(null);
      setConnectionTargetRejected(false);
      clearConnectionRejectFeedback();
      const world = screenToCanvas(event.clientX, event.clientY);
      setMouseWorld(world);
    },
    [readOnly, screenToCanvas, clearConnectionRejectFeedback],
  );

  // ---- node context menu ----
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, nodeId: string) => {
      event.preventDefault();
      event.stopPropagation();
      const state: ContextMenuState = {
        type: "node",
        x: event.clientX,
        y: event.clientY,
        nodeId,
      };
      if (onContextMenuProp) {
        onContextMenuProp(state);
      } else {
        setLocalContextMenu(state);
      }
    },
    [onContextMenuProp],
  );

  // ---- connection context menu ----
  const handleConnectionContextMenu = useCallback(
    (event: React.MouseEvent<SVGPathElement>, connectionId: string) => {
      event.preventDefault();
      event.stopPropagation();
      const state: ContextMenuState = {
        type: "connection",
        x: event.clientX,
        y: event.clientY,
        connectionId,
      };
      if (onContextMenuProp) {
        onContextMenuProp(state);
      } else {
        setLocalContextMenu(state);
      }
    },
    [onContextMenuProp],
  );

  // ---- node resize ----
  const handleNodeResize = useCallback(
    (nodeId: string, width: number, height: number, position?: Position) => {
      const updated = nodesRef.current.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              width,
              height,
              position: position ?? n.position,
            }
          : n,
      );
      onNodesChange(updated);
    },
    [onNodesChange],
  );

  // ---- node content change ----
  const handleContentChange = useCallback(
    (nodeId: string, content: string) => {
      const updated = nodesRef.current.map((n) =>
        n.id === nodeId
          ? { ...n, metadata: { ...n.metadata, content } }
          : n,
      );
      onNodesChange(updated);
    },
    [onNodesChange],
  );

  // ---- canvas mouse down (box selection) ----
  const handleCanvasMouseDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const world = screenToCanvas(event.clientX, event.clientY);
      const additive = event.ctrlKey || event.metaKey;

      const box: SelectionBox = {
        startWorldX: world.x,
        startWorldY: world.y,
        currentWorldX: world.x,
        currentWorldY: world.y,
        additive,
        initialSelectedNodeIds: additive
          ? [...selectedNodeIdsRef.current]
          : [],
      };
      setSelectionBox(box);
      selectionBoxRef.current = box;
    },
    [screenToCanvas],
  );

  // ---- global mouse move / up ----
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      const vp = viewportRef.current;

      // --- batch connection drag ---
      if (batchConnectingRef.current) {
        let worldX: number;
        let worldY: number;
        if (rect) {
          worldX = (event.clientX - rect.left - vp.x) / vp.k;
          worldY = (event.clientY - rect.top - vp.y) / vp.k;
        } else {
          worldX = 0;
          worldY = 0;
        }
        setMouseWorld({ x: worldX, y: worldY });

        const excludeIds = new Set(selectedNodeIdsRef.current);
        const targetNode = findBatchDropTargetAtWorld(worldX, worldY, excludeIds);
        if (targetNode) {
          const validation = evaluateBatchConnectionTarget(
            selectedNodeIdsRef.current,
            targetNode,
          );
          setConnectionTargetNodeId(targetNode.id);
          setConnectionTargetRejected(!validation.ok);
          if (!validation.ok && validation.reason) {
            showRejectReason(validation.reason);
          }
        } else {
          setConnectionTargetNodeId(null);
          setConnectionTargetRejected(false);
          lastHoverRejectReasonRef.current = null;
        }
        return;
      }

      // --- connection creation drag ---
      if (connectingParamsRef.current) {
        let worldX: number;
        let worldY: number;
        if (rect) {
          worldX = (event.clientX - rect.left - vp.x) / vp.k;
          worldY = (event.clientY - rect.top - vp.y) / vp.k;
        } else {
          worldX = 0;
          worldY = 0;
        }
        setMouseWorld({ x: worldX, y: worldY });

        // Detect drop target
        let targetId: string | null = null;
        let rejected = false;
        const params = connectingParamsRef.current!;
        const targetNode = findDropTargetAtWorld(
          worldX,
          worldY,
          params.nodeId,
        );
        if (targetNode) {
          targetId = targetNode.id;
          const validation = evaluateConnectionTarget(params, targetNode);
          rejected = !validation.ok;
          if (rejected && validation.reason) {
            showRejectReason(validation.reason);
          }
        } else {
          lastHoverRejectReasonRef.current = null;
        }
        setConnectionTargetNodeId(targetId);
        setConnectionTargetRejected(rejected);
        return;
      }

      // --- node drag ---
      if (dragRef.current.isDraggingNode) {
        const dx = (event.clientX - dragRef.current.startX) / vp.k;
        const dy = (event.clientY - dragRef.current.startY) / vp.k;

        if (
          Math.abs(dx) > 2 / vp.k ||
          Math.abs(dy) > 2 / vp.k
        ) {
          dragRef.current.hasMoved = true;
        }

        const updated = nodesRef.current.map((n) => {
          const initial = dragRef.current.initialPositions.find(
            (p) => p.id === n.id,
          );
          if (!initial) return n;
          let x = initial.x + dx;
          let y = initial.y + dy;
          if (snapOnRef.current) {
            x = snapToGrid(x);
            y = snapToGrid(y);
          }
          return {
            ...n,
            position: { x, y },
          };
        });

        nextNodesRef.current = updated;
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            if (nextNodesRef.current) onNodesChange(nextNodesRef.current);
          });
        }
        return;
      }

      // --- selection box drag ---
      if (selectionBoxRef.current) {
        let worldX: number;
        let worldY: number;
        if (rect) {
          worldX = (event.clientX - rect.left - vp.x) / vp.k;
          worldY = (event.clientY - rect.top - vp.y) / vp.k;
        } else {
          worldX = selectionBoxRef.current.currentWorldX;
          worldY = selectionBoxRef.current.currentWorldY;
        }

        const updatedBox: SelectionBox = {
          ...selectionBoxRef.current,
          currentWorldX: worldX,
          currentWorldY: worldY,
        };
        setSelectionBox(updatedBox);
        selectionBoxRef.current = updatedBox;

        // Compute which nodes are inside the box
        const boxLeft = Math.min(updatedBox.startWorldX, updatedBox.currentWorldX);
        const boxTop = Math.min(updatedBox.startWorldY, updatedBox.currentWorldY);
        const boxRight = Math.max(updatedBox.startWorldX, updatedBox.currentWorldX);
        const boxBottom = Math.max(updatedBox.startWorldY, updatedBox.currentWorldY);

        const insideIds = nodesRef.current
          .filter((n) => {
            const nodeLeft = n.position.x;
            const nodeTop = n.position.y;
            const nodeRight = n.position.x + n.width;
            const nodeBottom = n.position.y + n.height;
            return (
              nodeLeft >= boxLeft &&
              nodeTop >= boxTop &&
              nodeRight <= boxRight &&
              nodeBottom <= boxBottom
            );
          })
          .map((n) => n.id);

        if (updatedBox.additive) {
          const merged = new Set([
            ...updatedBox.initialSelectedNodeIds,
            ...insideIds,
          ]);
          onSelectionChange(Array.from(merged));
        } else {
          onSelectionChange(insideIds);
        }
        if (insideIds.length > 0) {
          setSelectedConnectionId(null);
        }
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      // --- end node drag ---
      if (dragRef.current.isDraggingNode) {
        if (!dragRef.current.hasMoved) {
          // Treat as click - selection already handled in mouseDown
        }
        dragRef.current.isDraggingNode = false;
        dragRef.current.hasMoved = false;
      }

      // --- end batch connection ---
      if (batchConnectingRef.current) {
        const rect = containerRef.current?.getBoundingClientRect();
        const vp = viewportRef.current;
        let worldX = 0;
        let worldY = 0;
        if (rect) {
          worldX = (event.clientX - rect.left - vp.x) / vp.k;
          worldY = (event.clientY - rect.top - vp.y) / vp.k;
        }

        const excludeIds = new Set(selectedNodeIdsRef.current);
        const dropTarget = findBatchDropTargetAtWorld(worldX, worldY, excludeIds);
        if (dropTarget) {
          const validation = evaluateBatchConnectionTarget(
            selectedNodeIdsRef.current,
            dropTarget,
          );
          if (validation.ok) {
            multiSelectActions?.onBatchConnect(dropTarget.id);
          } else if (validation.reason) {
            showRejectReason(validation.reason);
          }
        }

        setBatchConnecting(false);
        batchConnectingRef.current = false;
        setConnectionTargetNodeId(null);
        setConnectionTargetRejected(false);
        clearConnectionRejectFeedback();
      }

      // --- end connection creation ---
      if (connectingParamsRef.current) {
        const params = connectingParamsRef.current;

        const rect = containerRef.current?.getBoundingClientRect();
        const vp = viewportRef.current;
        let worldX = 0;
        let worldY = 0;
        if (rect) {
          worldX = (event.clientX - rect.left - vp.x) / vp.k;
          worldY = (event.clientY - rect.top - vp.y) / vp.k;
        }

        const dropTarget = findDropTargetAtWorld(
          worldX,
          worldY,
          params.nodeId,
        );
        const dropTargetId = dropTarget?.id ?? null;
        const intent = connectionDropIntent(dropTargetId, {
          x: worldX,
          y: worldY,
        });

        if (intent === "connect" && dropTarget) {
          const validation = evaluateConnectionTarget(params, dropTarget);
          if (validation.ok) {
            const { fromNodeId, toNodeId } = resolveConnectionEndpoints(
              params.nodeId,
              params.handleType,
              dropTarget.id,
            );

            const exists = connectionsRef.current.some(
              (c) => c.fromNodeId === fromNodeId && c.toNodeId === toNodeId,
            );
            if (!exists && fromNodeId !== toNodeId) {
              const newConn: CanvasConnection = {
                id: generateConnectionId(),
                fromNodeId,
                toNodeId,
              };
              onConnectionsChange([...connectionsRef.current, newConn]);
            }
          } else if (validation.reason) {
            showRejectReason(validation.reason);
          }
        } else if (intent === "create-at-drop" && onConnectionDropAtEmpty) {
          onConnectionDropAtEmpty({
            fromNodeId: params.nodeId,
            handleType: params.handleType,
            world: { x: worldX, y: worldY },
            client: { x: event.clientX, y: event.clientY },
          });
        }

        setConnectingParams(null);
        connectingParamsRef.current = null;
        setConnectionTargetNodeId(null);
        setConnectionTargetRejected(false);
        clearConnectionRejectFeedback();
      }

      // --- end selection box ---
      if (selectionBoxRef.current) {
        const box = selectionBoxRef.current;
        const vp = viewportRef.current;
        const width = Math.abs(box.currentWorldX - box.startWorldX);
        const height = Math.abs(box.currentWorldY - box.startWorldY);
        if (width * vp.k < 2 && height * vp.k < 2) {
          deselectAll();
        }
        setSelectionBox(null);
        selectionBoxRef.current = null;
      }

      // Flush any pending rAF
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        if (nextNodesRef.current) {
          onNodesChange(nextNodesRef.current);
          nextNodesRef.current = null;
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    onNodesChange,
    onConnectionsChange,
    onSelectionChange,
    onConnectionDropAtEmpty,
    deselectAll,
    findDropTargetAtWorld,
    findBatchDropTargetAtWorld,
    evaluateConnectionTarget,
    evaluateBatchConnectionTarget,
    multiSelectActions,
    showRejectReason,
    clearConnectionRejectFeedback,
  ]);

  useEffect(() => {
    return () => {
      if (connectionRejectTimerRef.current !== null) {
        window.clearTimeout(connectionRejectTimerRef.current);
      }
    };
  }, []);

  // ---- keyboard: Escape + WASD pan + E/Q zoom ----
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      if (event.key === "Escape") {
        setConnectingParams(null);
        connectingParamsRef.current = null;
        setBatchConnecting(false);
        batchConnectingRef.current = false;
        setConnectionTargetNodeId(null);
        setConnectionTargetRejected(false);
        clearConnectionRejectFeedback();
        setSelectionBox(null);
        selectionBoxRef.current = null;
        setLocalContextMenu(null);
        setSelectedConnectionId(null);
        return;
      }

      if (event.code === "KeyL" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        setSnapOn((v) => !v);
        return;
      }

      if (viewLockedRef.current) return;

      const delta = panDeltaFromKey(event.key, event.shiftKey);
      if (delta) {
        event.preventDefault();
        const vp = viewportRef.current;
        guardedViewportChange({
          ...vp,
          x: vp.x - delta.dx * vp.k,
          y: vp.y - delta.dy * vp.k,
        });
        return;
      }

      const zoomFactor = zoomFactorFromKey(event.key);
      if (zoomFactor) {
        event.preventDefault();
        zoomByFactor(zoomFactor);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [guardedViewportChange, zoomByFactor]);

  // ---- notify context menu changes to parent ----
  useEffect(() => {
    if (onContextMenuProp) {
      onContextMenuProp(localContextMenu);
    }
    // 仅在 localContextMenu 变化时通知父组件，避免父组件传入新函数引用
    // 触发 effect 把父组件 state 误清为 null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localContextMenu]);

  // ---- connection create menu trigger ----
  const handleConnectionCreateClick = useCallback(
    (event: React.MouseEvent, nodeId: string) => {
      event.preventDefault();
      event.stopPropagation();
      const world = screenToCanvas(event.clientX, event.clientY);
      onConnectionCreateClick?.(event, nodeId, world);
    },
    [onConnectionCreateClick, screenToCanvas],
  );

  // ---- canvas double click (blank) ----
  const handleCanvasDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const world = screenToCanvas(event.clientX, event.clientY);
      onCanvasDoubleClick?.(world, { x: event.clientX, y: event.clientY });
    },
    [onCanvasDoubleClick, screenToCanvas],
  );

  // ---- canvas context menu handler ----
  const handleCanvasContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      const world = screenToCanvas(event.clientX, event.clientY);
      const state: ContextMenuState = {
        type: "pane",
        x: event.clientX,
        y: event.clientY,
        worldX: world.x,
        worldY: world.y,
      };
      if (onContextMenuProp) {
        onContextMenuProp(state);
      } else {
        setLocalContextMenu(state);
      }
    },
    [onContextMenuProp, screenToCanvas],
  );

  const handleCanvasDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (readOnly) return;
      if (onAssetDropAt && isSessionAssetDrag(event.dataTransfer)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        return;
      }
      if (!onMediaUploadAt) return;
      const hasFiles =
        event.dataTransfer.types.includes("Files") ||
        event.dataTransfer.files.length > 0;
      if (!hasFiles) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    [readOnly, onMediaUploadAt, onAssetDropAt],
  );

  const handleCanvasDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (readOnly) return;
      if (onAssetDropAt && isSessionAssetDrag(event.dataTransfer)) {
        event.preventDefault();
        event.stopPropagation();
        const itemId = readSessionAssetId(event.dataTransfer);
        if (!itemId) return;
        const world = screenToCanvas(event.clientX, event.clientY);
        onAssetDropAt(itemId, world);
        return;
      }
      if (!onMediaUploadAt) return;
      event.preventDefault();
      event.stopPropagation();
      const mediaFiles = filterMediaFiles(Array.from(event.dataTransfer.files ?? []));
      if (mediaFiles.length === 0) return;
      const world = screenToCanvas(event.clientX, event.clientY);
      onMediaUploadAt(mediaFiles, world);
    },
    [readOnly, onMediaUploadAt, onAssetDropAt, screenToCanvas],
  );

  useEffect(() => {
    if (readOnly || !onMediaUploadAt) return;
    const handlePaste = (event: ClipboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const mediaFiles = filterMediaFiles(
        Array.from(event.clipboardData?.files ?? []),
      );
      if (mediaFiles.length === 0) return;
      event.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      const vp = viewportRef.current;
      const world = rect
        ? {
            x: (-vp.x + rect.width / 2) / vp.k,
            y: (-vp.y + rect.height / 2) / vp.k,
          }
        : { x: 0, y: 0 };
      onMediaUploadAt(mediaFiles, world);
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [readOnly, onMediaUploadAt]);

  // ---- build a lookup for node data (used in connection rendering) ----
  const nodeMap = useRef<Map<string, CanvasNodeData>>(new Map());
  nodeMap.current = new Map(nodes.map((n) => [n.id, n]));

  // ---- selection box overlay computed dimensions (in screen space) ----
  const selectionBoxScreen = selectionBox
    ? (() => {
        const vp = viewport;
        const left = Math.min(selectionBox.startWorldX, selectionBox.currentWorldX);
        const top = Math.min(selectionBox.startWorldY, selectionBox.currentWorldY);
        const right = Math.max(selectionBox.startWorldX, selectionBox.currentWorldX);
        const bottom = Math.max(selectionBox.startWorldY, selectionBox.currentWorldY);
        return {
          left: left * vp.k + vp.x,
          top: top * vp.k + vp.y,
          width: (right - left) * vp.k,
          height: (bottom - top) * vp.k,
        };
      })()
    : null;

  const multiSelectToolbarScreen = (() => {
    if (selectedNodeIds.length < 2 || !multiSelectActions) return null;
    const selected = nodes.filter((n) => selectedNodeIds.includes(n.id));
    if (selected.length < 2) return null;
    const vp = viewport;
    const minX = Math.min(...selected.map((n) => n.position.x));
    const minY = Math.min(...selected.map((n) => n.position.y));
    const maxX = Math.max(...selected.map((n) => n.position.x + n.width));
    const centerX = (minX + maxX) / 2;
    return {
      left: centerX * vp.k + vp.x,
      top: minY * vp.k + vp.y - 12,
    };
  })();

  // ---- the connecting node data ----
  const connectingNode = connectingParams
    ? nodeMap.current.get(connectingParams.nodeId)
    : undefined;
  const connectionTargetNode = connectionTargetNodeId
    ? nodeMap.current.get(connectionTargetNodeId)
    : undefined;

  const selectedConnection = selectedConnectionId
    ? connections.find((conn) => conn.id === selectedConnectionId)
    : null;
  const selectedConnectionMidpoint = (() => {
    if (!selectedConnection) return null;
    const fromNode = nodeMap.current.get(selectedConnection.fromNodeId);
    const toNode = nodeMap.current.get(selectedConnection.toNodeId);
    if (!fromNode || !toNode) return null;
    return getConnectionPathGeometry(fromNode, toNode).midpoint;
  })();

  return (
    <div className="relative h-full w-full">
      <InfiniteCanvas
        containerRef={containerRef}
        viewport={viewport}
        backgroundMode={backgroundMode}
        gridVisible={gridOn}
        viewLocked={viewLocked}
        onViewportChange={guardedViewportChange}
        onCanvasMouseDown={handleCanvasMouseDown}
        onCanvasDoubleClick={handleCanvasDoubleClick}
        onCanvasDeselect={deselectAll}
        onContextMenu={handleCanvasContextMenu}
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}
      >
        {/* Connection layer */}
        <CanvasConnections>
          {connections.map((conn) => {
            const fromNode = nodeMap.current.get(conn.fromNodeId);
            const toNode = nodeMap.current.get(conn.toNodeId);
            if (!fromNode || !toNode) return null;
            return (
              <ConnectionPath
                key={conn.id}
                connection={conn}
                from={fromNode}
                to={toNode}
                active={selectedConnectionId === conn.id}
                animated={edgeAnimOn}
                onSelect={() => {
                  setSelectedConnectionId(conn.id);
                  onSelectionChange([]);
                }}
                onContextMenu={(e) =>
                  handleConnectionContextMenu(e, conn.id)
                }
              />
            );
          })}
          {connectingParams && (
            <ActiveConnectionPath
              node={connectingNode}
              handle={connectingParams}
              mouseWorld={mouseWorld}
              target={connectionTargetNode}
              rejected={connectionTargetRejected}
              animated={edgeAnimOn}
            />
          )}
          {batchConnecting &&
            selectedNodeIds.map((nodeId) => {
              const node = nodeMap.current.get(nodeId);
              if (!node) return null;
              return (
                <ActiveConnectionPath
                  key={`batch-${nodeId}`}
                  node={node}
                  handle={{ nodeId, handleType: "source" }}
                  mouseWorld={mouseWorld}
                  target={connectionTargetNode}
                  rejected={connectionTargetRejected}
                  animated={edgeAnimOn}
                />
              );
            })}
        </CanvasConnections>

        {selectedConnectionMidpoint && onDeleteConnection ? (
          <ConnectionScissors
            x={selectedConnectionMidpoint.x}
            y={selectedConnectionMidpoint.y}
            onDelete={() => onDeleteConnection(selectedConnectionId!)}
          />
        ) : null}

        {/* Node layer */}
        {nodes.map((node) => (
          <CanvasNode
            key={node.id}
            data={node}
            scale={viewport.k}
            isSelected={selectedNodeIds.includes(node.id)}
            isRelated={hoveredNodeId === node.id}
            isFocusRelated={false}
            isConnectionTarget={
              connectionTargetNodeId === node.id ||
              (batchConnecting && connectionTargetNodeId === node.id)
            }
            isConnectionTargetRejected={
              connectionTargetNodeId === node.id && connectionTargetRejected
            }
            isConnecting={Boolean(connectingParams) || batchConnecting}
            showPanel={
              Boolean(renderPanel) &&
              selectedNodeIds.length === 1 &&
              selectedNodeIds[0] === node.id
            }
            renderPanel={renderPanel}
            showImageInfo={true}
            onMouseDown={handleNodeMouseDown}
            onHoverStart={setHoveredNodeId}
            onHoverEnd={() => setHoveredNodeId(null)}
            onConnectStart={handleConnectStart}
            onConnectionCreateClick={
              onConnectionCreateClick ? handleConnectionCreateClick : undefined
            }
            onResize={handleNodeResize}
            onContentChange={handleContentChange}
            onContextMenu={handleNodeContextMenu}
            onNodeDoubleClick={onNodeDoubleClick}
            onTitleChange={onTitleChange}
            renderNodeContent={renderNodeContent}
          />
        ))}
      </InfiniteCanvas>

      {/* Mini map */}
      {showMiniMap && (
        <CanvasMiniMap
          nodes={nodes}
          viewport={viewport}
          viewportSize={{
            width: containerRef.current?.clientWidth ?? 800,
            height: containerRef.current?.clientHeight ?? 600,
          }}
          onViewportChange={guardedViewportChange}
          bottomInsetPx={overlayBottomInsetPx}
        />
      )}

      {/* Left-bottom guide + chrome toggles (workflow shell only) */}
      {workflowShell ? (
        <div
          className="absolute left-4 z-50 flex items-end gap-2"
          style={{ bottom: infiniteLeftChromeBottom(overlayBottomInsetPx) }}
          data-canvas-no-zoom
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <CanvasGuideCapsule workflowShell={workflowShell} />
          <CanvasChromeBar
            gridOn={gridOn}
            snapOn={snapOn}
            edgeAnimOn={edgeAnimOn}
            viewLocked={viewLocked}
            onGridChange={setGridOn}
            onSnapChange={setSnapOn}
            onEdgeAnimChange={setEdgeAnimOn}
            onViewLockedChange={setViewLocked}
          />
        </div>
      ) : null}

      {/* Zoom controls */}
      {showZoomControlsProp !== false && (
        <CanvasZoomControls
          scale={viewport.k}
          onScaleChange={setZoomScale}
          onReset={resetViewport}
          isMiniMapOpen={isMiniMapOpen}
          onToggleMiniMap={() => setIsMiniMapOpen((v) => !v)}
          bottomInsetPx={overlayBottomInsetPx}
        />
      )}

      {/* Selection box overlay */}
      {selectionBoxScreen && (
        <div
          className="pointer-events-none absolute border"
          style={{
            left: selectionBoxScreen.left,
            top: selectionBoxScreen.top,
            width: selectionBoxScreen.width,
            height: selectionBoxScreen.height,
            borderColor: canvasTheme.canvas.selectionStroke,
            backgroundColor: canvasTheme.canvas.selectionFill,
          }}
        />
      )}

      {multiSelectToolbarScreen && multiSelectActions ? (
        <MultiSelectToolbar
          left={multiSelectToolbarScreen.left}
          top={multiSelectToolbarScreen.top}
          count={selectedNodeIds.length}
          readOnly={readOnly}
          onGroup={multiSelectActions.onGroup}
          onLayout={multiSelectActions.onLayout}
          onDownload={multiSelectActions.onDownload}
          onDelete={multiSelectActions.onDelete}
          onConnectHandleMouseDown={handleBatchConnectStart}
        />
      ) : null}

      {connectionRejectMessage ? (
        <div
          className="pointer-events-none absolute bottom-6 left-1/2 z-[70] max-w-sm -translate-x-1/2 rounded-lg border px-3 py-2 text-xs text-red-100 shadow-lg backdrop-blur-md"
          style={{
            borderColor: "rgba(239,68,68,0.45)",
            background: "rgba(127,29,29,0.85)",
          }}
          data-testid="connection-reject-toast"
          role="status"
        >
          {connectionRejectMessage}
        </div>
      ) : null}

      {multiSelectNotice ? (
        <div
          className="pointer-events-none absolute bottom-14 left-1/2 z-[70] max-w-sm -translate-x-1/2 rounded-lg border px-3 py-2 text-xs text-emerald-100 shadow-lg backdrop-blur-md"
          style={{
            borderColor: "rgba(52,211,153,0.45)",
            background: "rgba(6,78,59,0.85)",
          }}
          data-testid="multi-select-notice"
          role="status"
        >
          {multiSelectNotice}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CanvasConnections wrapper – renders an SVG layer for all connections
// ---------------------------------------------------------------------------

function CanvasConnections({ children }: { children: ReactNode }) {
  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 h-full w-full overflow-visible"
      style={{ zIndex: 0 }}
    >
      {children}
    </svg>
  );
}
