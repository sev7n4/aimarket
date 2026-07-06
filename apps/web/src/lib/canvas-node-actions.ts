import { CanvasNodeType, type CanvasNodeData } from "@/components/infinite-canvas/types";
import {
  buildInfiniteNodeMenuGroups,
  type InfiniteNodeMenuAction,
  type InfiniteNodeMenuGroup,
  type InfiniteNodeMenuHandlers,
} from "@/components/infinite-canvas/infinite-node-menu-actions";
import type { CanvasItem } from "@/lib/canvas-tools";

export type CanvasNodeMenuAction = InfiniteNodeMenuAction;
export type CanvasNodeMenuGroup = InfiniteNodeMenuGroup;
export type CanvasNodeMenuHandlers = InfiniteNodeMenuHandlers;

export type ScrollContextMenuHandlers = {
  onCutout?: () => void;
  onExpand?: () => void;
  onDownload: () => void;
  onDelete: () => void;
};

const SCROLL_CONTEXT_ACTION_IDS = new Set([
  "cutout",
  "expand",
  "download",
  "delete",
]);

function canvasItemToNode(item: CanvasItem): CanvasNodeData {
  return {
    id: item.id,
    type: item.isVideo ? CanvasNodeType.Video : CanvasNodeType.Image,
    title: "",
    position: { x: item.x, y: item.y },
    width: item.width,
    height: item.height,
    metadata: item.url ? { content: item.url } : undefined,
  };
}

function filterScrollContextGroups(
  groups: CanvasNodeMenuGroup[],
): CanvasNodeMenuGroup[] {
  return groups
    .map((group) => ({
      ...group,
      actions: group.actions.filter((action) =>
        SCROLL_CONTEXT_ACTION_IDS.has(action.id),
      ),
    }))
    .filter((group) => group.actions.length > 0);
}

export type BuildCanvasNodeActionsInput =
  | {
      mode: "infinite";
      node: CanvasNodeData;
      handlers: InfiniteNodeMenuHandlers;
      wrapOnClick?: (fn?: () => void) => (() => void) | undefined;
    }
  | {
      mode: "scroll";
      item: CanvasItem;
      handlers: ScrollContextMenuHandlers;
      wrapOnClick?: (fn?: () => void) => (() => void) | undefined;
    };

/** Scroll / Infinite 节点右键菜单统一入口 */
export function buildCanvasNodeActions(
  input: BuildCanvasNodeActionsInput,
): CanvasNodeMenuGroup[] {
  if (input.mode === "infinite") {
    return buildInfiniteNodeMenuGroups(input.node, input.handlers, {
      wrapOnClick: input.wrapOnClick,
    });
  }

  const node = canvasItemToNode(input.item);
  const menuHandlers: InfiniteNodeMenuHandlers = {
    onCutout: input.handlers.onCutout,
    onExpand: input.handlers.onExpand,
    onDownload: input.handlers.onDownload,
    onDelete: input.handlers.onDelete,
  };
  const groups = buildInfiniteNodeMenuGroups(node, menuHandlers, {
    wrapOnClick: input.wrapOnClick,
  });
  return filterScrollContextGroups(groups);
}

export {
  buildInfiniteNodeMenuGroups,
  infiniteNodeMenuToToolbarActions,
} from "@/components/infinite-canvas/infinite-node-menu-actions";
