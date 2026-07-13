"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { panDeltaFromKey, zoomFactorFromKey } from "@/lib/canvas-nav";
import { canvasTheme, type CanvasBackgroundMode } from "./canvas-theme";
import { CanvasChromeBar } from "./CanvasChromeBar";
import { CanvasGuideCapsule } from "./CanvasGuideCapsule";
import { infiniteLeftChromeBottom } from "./infinite-canvas-layout";
import { InfiniteCanvas } from "./InfiniteCanvas";
import { CanvasNode } from "./CanvasNode";
import { ConnectionPath, ActiveConnectionPath } from "./CanvasConnections";
import { CanvasMiniMap } from "./CanvasMiniMap";
import { CanvasZoomControls } from "./CanvasZoomControls";
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
  onCanvasDoubleClick?: (world: Position, client: { x: number; y: number }) => void;
  onContextMenu?: (state: ContextMenuState | null) => void;
  renderNodeContent?: (node: CanvasNodeData) => ReactNode;
  renderPanel?: (node: CanvasNodeData) => ReactNode;
  backgroundMode?: CanvasBackgroundMode;
  showMiniMap?: boolean;
  showZoomControls?: boolean;
  /** 左下角控件需额外抬高的像素（避开 StudioDock） */
  overlayBottomInsetPx?: number;
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
  onNodesChange,
  onConnectionsChange,
  onViewportChange,
  onSelectionChange,
  onNodeDoubleClick,
  onConnectionCreateClick,
  onCanvasDoubleClick,
  onContextMenu: onContextMenuProp,
  renderNodeContent,
  renderPanel,
  backgroundMode = "lines",
  showMiniMap: showMiniMapProp,
  showZoomControls: showZoomControlsProp,
  overlayBottomInsetPx = 0,
}: InfiniteCanvasContainerProps) {
  // ---- local state ----
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | null
  >(null);
  const [connectingParams, setConnectingParams] =
    useState<ConnectionHandle | null>(null);
  const [connectionTargetNodeId, setConnectionTargetNodeId] = useState<
    string | null
  >(null);
  const [mouseWorld, setMouseWorld] = useState<Position>({ x: 0, y: 0 });
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [localContextMenu, setLocalContextMenu] =
    useState<ContextMenuState | null>(null);
  const [isMiniMapOpen, setIsMiniMapOpen] = useState(true);
  const [gridOn, setGridOn] = useState(true);
  const [snapOn, setSnapOn] = useState(false);
  const [edgeAnimOn, setEdgeAnimOn] = useState(true);
  const [viewLocked, setViewLocked] = useState(false);

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
  }, [onSelectionChange]);

  // ---- node mouse down (drag + selection) ----
  const handleNodeMouseDown = useCallback(
    (event: React.MouseEvent, nodeId: string) => {
      event.stopPropagation();

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
    [onSelectionChange],
  );

  // ---- connection start ----
  const handleConnectStart = useCallback(
    (event: React.MouseEvent, nodeId: string, handleType: "source" | "target") => {
      event.stopPropagation();
      event.preventDefault();
      const params: ConnectionHandle = { nodeId, handleType };
      setConnectingParams(params);
      connectingParamsRef.current = params;

      const world = screenToCanvas(event.clientX, event.clientY);
      setMouseWorld(world);
    },
    [screenToCanvas],
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
        for (const node of nodesRef.current) {
          if (node.id === connectingParamsRef.current!.nodeId) continue;
          if (isPointNearNode(worldX, worldY, node)) {
            targetId = node.id;
            break;
          }
        }
        setConnectionTargetNodeId(targetId);
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
      }
    };

    const handleMouseUp = () => {
      // --- end node drag ---
      if (dragRef.current.isDraggingNode) {
        if (!dragRef.current.hasMoved) {
          // Treat as click - selection already handled in mouseDown
        }
        dragRef.current.isDraggingNode = false;
        dragRef.current.hasMoved = false;
      }

      // --- end connection creation ---
      if (connectingParamsRef.current) {
        const params = connectingParamsRef.current;
        const targetId = connectionTargetNodeId; // read from state is fine on mouseup

        // We need to read the latest target from ref approach
        // Since connectionTargetNodeId is state, we check via the event position
        const rect = containerRef.current?.getBoundingClientRect();
        const vp = viewportRef.current;
        let worldX = 0;
        let worldY = 0;
        if (rect && event instanceof MouseEvent) {
          worldX = (event.clientX - rect.left - vp.x) / vp.k;
          worldY = (event.clientY - rect.top - vp.y) / vp.k;
        }

        let dropTargetId: string | null = null;
        for (const node of nodesRef.current) {
          if (node.id === params.nodeId) continue;
          if (isPointNearNode(worldX, worldY, node)) {
            dropTargetId = node.id;
            break;
          }
        }

        if (dropTargetId) {
          // Normalize: source → target
          let fromNodeId: string;
          let toNodeId: string;
          if (params.handleType === "source") {
            fromNodeId = params.nodeId;
            toNodeId = dropTargetId;
          } else {
            fromNodeId = dropTargetId;
            toNodeId = params.nodeId;
          }

          // Prevent duplicate connections
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
        }

        setConnectingParams(null);
        connectingParamsRef.current = null;
        setConnectionTargetNodeId(null);
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
    connectionTargetNodeId,
    deselectAll,
  ]);

  // ---- keyboard: Escape + WASD pan + E/Q zoom ----
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      if (event.key === "Escape") {
        setConnectingParams(null);
        connectingParamsRef.current = null;
        setConnectionTargetNodeId(null);
        setSelectionBox(null);
        selectionBoxRef.current = null;
        setLocalContextMenu(null);
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

  // ---- the connecting node data ----
  const connectingNode = connectingParams
    ? nodeMap.current.get(connectingParams.nodeId)
    : undefined;
  const connectionTargetNode = connectionTargetNodeId
    ? nodeMap.current.get(connectionTargetNodeId)
    : undefined;

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
                onSelect={() => setSelectedConnectionId(conn.id)}
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
              animated={edgeAnimOn}
            />
          )}
        </CanvasConnections>

        {/* Node layer */}
        {nodes.map((node) => (
          <CanvasNode
            key={node.id}
            data={node}
            scale={viewport.k}
            isSelected={selectedNodeIds.includes(node.id)}
            isRelated={hoveredNodeId === node.id}
            isFocusRelated={false}
            isConnectionTarget={connectionTargetNodeId === node.id}
            isConnecting={Boolean(connectingParams)}
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

      {/* Left-bottom guide + chrome toggles */}
      <div
        className="absolute left-4 z-50 flex items-end gap-2"
        style={{ bottom: infiniteLeftChromeBottom(overlayBottomInsetPx) }}
        data-canvas-no-zoom
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <CanvasGuideCapsule />
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
