"use client";

import { CanvasContextMenu } from "@/components/canvas-context-menu";
import { InfiniteCanvasContextMenu } from "@/components/infinite-canvas/InfiniteCanvasContextMenu";
import { NodeCreateMenu } from "@/components/infinite-canvas/NodeCreateMenu";
import { ConnectionCreateMenu } from "@/components/infinite-canvas/ConnectionCreateMenu";
import { ConnectionContextMenu } from "@/components/infinite-canvas/ConnectionContextMenu";
import { buildCanvasNodeActions } from "@/lib/canvas-node-actions";
import type { CanvasItem } from "@/lib/canvas-tools";
import type { CanvasNodeData, CanvasNodeType } from "@/components/infinite-canvas/types";
import type { InfiniteNodeMenuHandlers } from "@/components/infinite-canvas/infinite-node-menu-actions";

export type CanvasPaneMenusProps = {
  contextMenu: { item: CanvasItem; x: number; y: number } | null;
  onCloseContextMenu: () => void;
  onSelect: (id: string | null) => void;
  onDownload: () => void;
  onDeleteSelected: () => void;
  onCutoutItem?: (item: CanvasItem) => void;
  onExpandItem?: (item: CanvasItem) => void;
  infiniteContextMenu: { node: CanvasNodeData; x: number; y: number } | null;
  onCloseInfiniteContextMenu: () => void;
  getInfiniteNodeMenuHandlers: (node: CanvasNodeData) => InfiniteNodeMenuHandlers;
  paneCreateMenu: { x: number; y: number; worldX: number; worldY: number } | null;
  onClosePaneCreateMenu: () => void;
  allowDramaNodeCreate: boolean;
  onCreateNodeAt: (type: CanvasNodeType, worldX: number, worldY: number) => void;
  connectionCreateMenu: {
    sourceNodeId: string;
    x: number;
    y: number;
    worldX?: number;
    worldY?: number;
    connectAs?: "downstream" | "upstream";
  } | null;
  onCloseConnectionCreateMenu: () => void;
  onCreateDownstreamNode: (
    sourceNodeId: string,
    type: CanvasNodeType,
    options?: {
      worldX?: number;
      worldY?: number;
      connectAs?: "downstream" | "upstream";
    },
  ) => void;
  connectionContextMenu: { connectionId: string; x: number; y: number } | null;
  onCloseConnectionContextMenu: () => void;
  onDeleteConnection: (connectionId: string) => void;
};

export function CanvasPaneMenus({
  contextMenu,
  onCloseContextMenu,
  onSelect,
  onDownload,
  onDeleteSelected,
  onCutoutItem,
  onExpandItem,
  infiniteContextMenu,
  onCloseInfiniteContextMenu,
  getInfiniteNodeMenuHandlers,
  paneCreateMenu,
  onClosePaneCreateMenu,
  allowDramaNodeCreate,
  onCreateNodeAt,
  connectionCreateMenu,
  onCloseConnectionCreateMenu,
  onCreateDownstreamNode,
  connectionContextMenu,
  onCloseConnectionContextMenu,
  onDeleteConnection,
}: CanvasPaneMenusProps) {
  return (
    <>
      {contextMenu ? (
        <CanvasContextMenu
          groups={buildCanvasNodeActions({
            mode: "scroll",
            item: contextMenu.item,
            handlers: {
              onCutout:
                onCutoutItem && contextMenu.item.outputId
                  ? () => onCutoutItem(contextMenu.item)
                  : undefined,
              onExpand:
                onExpandItem && contextMenu.item.outputId
                  ? () => onExpandItem(contextMenu.item)
                  : undefined,
              onDownload: () => {
                onSelect(contextMenu.item.id);
                onDownload();
              },
              onDelete: () => {
                onSelect(contextMenu.item.id);
                onDeleteSelected();
              },
            },
            wrapOnClick: (fn) =>
              fn
                ? () => {
                    fn();
                    onCloseContextMenu();
                  }
                : undefined,
          })}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={onCloseContextMenu}
        />
      ) : null}

      {infiniteContextMenu ? (
        <InfiniteCanvasContextMenu
          node={infiniteContextMenu.node}
          x={infiniteContextMenu.x}
          y={infiniteContextMenu.y}
          onClose={onCloseInfiniteContextMenu}
          handlers={getInfiniteNodeMenuHandlers(infiniteContextMenu.node)}
        />
      ) : null}

      {paneCreateMenu ? (
        <NodeCreateMenu
          x={paneCreateMenu.x}
          y={paneCreateMenu.y}
          showDramaTypes={allowDramaNodeCreate}
          onSelect={(type) =>
            onCreateNodeAt(type, paneCreateMenu.worldX, paneCreateMenu.worldY)
          }
          onClose={onClosePaneCreateMenu}
        />
      ) : null}

      {connectionCreateMenu ? (
        <ConnectionCreateMenu
          x={connectionCreateMenu.x}
          y={connectionCreateMenu.y + 4}
          onSelect={(type) =>
            onCreateDownstreamNode(connectionCreateMenu.sourceNodeId, type, {
              worldX: connectionCreateMenu.worldX,
              worldY: connectionCreateMenu.worldY,
              connectAs: connectionCreateMenu.connectAs,
            })
          }
          onClose={onCloseConnectionCreateMenu}
        />
      ) : null}

      {connectionContextMenu ? (
        <ConnectionContextMenu
          x={connectionContextMenu.x}
          y={connectionContextMenu.y}
          onDelete={() => onDeleteConnection(connectionContextMenu.connectionId)}
          onClose={onCloseConnectionContextMenu}
        />
      ) : null}
    </>
  );
}
