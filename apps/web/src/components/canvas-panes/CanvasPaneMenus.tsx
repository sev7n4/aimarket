"use client";

import { CanvasContextMenu } from "@/components/canvas-context-menu";
import { buildCanvasNodeActions } from "@/lib/canvas-node-actions";
import type { CanvasItem } from "@/lib/canvas-tools";

export type CanvasPaneMenusProps = {
  contextMenu: { item: CanvasItem; x: number; y: number } | null;
  onCloseContextMenu: () => void;
  onSelect: (id: string | null) => void;
  onDownload: () => void;
  onDeleteSelected: () => void;
  onCutoutItem?: (item: CanvasItem) => void;
};

export function CanvasPaneMenus({
  contextMenu,
  onCloseContextMenu,
  onSelect,
  onDownload,
  onDeleteSelected,
  onCutoutItem,
}: CanvasPaneMenusProps) {
  if (!contextMenu) return null;

  return (
    <CanvasContextMenu
      groups={buildCanvasNodeActions({
        item: contextMenu.item,
        handlers: {
          onCutout:
            onCutoutItem && contextMenu.item.outputId
              ? () => onCutoutItem(contextMenu.item)
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
  );
}
