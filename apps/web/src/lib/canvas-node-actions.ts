import type { CanvasItem } from "@/lib/canvas-tools";

export type CanvasNodeMenuAction = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  separatorAfter?: boolean;
};

export type CanvasNodeMenuGroup = {
  id: string;
  label?: string;
  actions: CanvasNodeMenuAction[];
};

export type ScrollContextMenuHandlers = {
  onCutout?: () => void;
  onDownload: () => void;
  onDelete: () => void;
};

export type BuildCanvasNodeActionsInput = {
  item: CanvasItem;
  handlers: ScrollContextMenuHandlers;
  wrapOnClick?: (fn?: () => void) => (() => void) | undefined;
};

/** Scroll 画布右键菜单 */
export function buildCanvasNodeActions(
  input: BuildCanvasNodeActionsInput,
): CanvasNodeMenuGroup[] {
  const { item, handlers, wrapOnClick = (fn) => fn } = input;
  const actions: CanvasNodeMenuAction[] = [];

  if (handlers.onCutout && item.outputId) {
    actions.push({
      id: "cutout",
      label: "抠图",
      onClick: wrapOnClick(handlers.onCutout),
    });
  }

  actions.push({
    id: "download",
    label: "下载",
    onClick: wrapOnClick(handlers.onDownload),
  });

  actions.push({
    id: "delete",
    label: "删除",
    danger: true,
    onClick: wrapOnClick(handlers.onDelete),
  });

  return actions.length > 0 ? [{ id: "scroll-context", actions }] : [];
}
