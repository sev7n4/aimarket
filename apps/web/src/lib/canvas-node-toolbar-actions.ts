import { buildCanvasToolActions } from "@/components/canvas-tool-actions";
import type { OverflowIconAction } from "@/components/overflow-icon-row";
import type { CanvasItem } from "@/lib/canvas-tools";
import type { StudioTool } from "@/lib/types";

import {
  buildInfiniteNodeMenuGroups,
  infiniteNodeMenuToToolbarActions,
  type InfiniteNodeMenuHandlers,
} from "@/components/infinite-canvas/infinite-node-menu-actions";
import type { CanvasNodeData } from "@/components/infinite-canvas/types";

/** 节点菜单 action id → Studio 工具 id（去重用） */
const MENU_ACTION_TO_STUDIO_TOOL: Record<string, string> = {
  cutout: "cutout",
  expand: "expand",
};

function studioToolIdsFromActions(actions: OverflowIconAction[]): Set<string> {
  const ids = new Set<string>();
  for (const action of actions) {
    const match = action.id.match(/^canvas-batch-tool-(.+)$/);
    if (match?.[1]) ids.add(match[1]);
  }
  return ids;
}

function menuActionStudioKey(menuActionId: string): string | null {
  const match = menuActionId.match(/^infinite-node-tool-(.+)$/);
  return match?.[1] ?? null;
}

/**
 * 合并 Studio 工具与节点菜单工具，按能力去重。
 * Studio 工具优先（含 pending / disabled 状态）。
 */
export function buildCanvasNodeToolbarActions(opts: {
  node: CanvasNodeData;
  handlers: InfiniteNodeMenuHandlers;
  item?: CanvasItem | null;
  tools?: StudioTool[];
  pendingToolId?: string | null;
  onRunTool?: (tool: StudioTool, item: CanvasItem) => void;
}): OverflowIconAction[] {
  const { node, handlers, item, tools, pendingToolId, onRunTool } = opts;

  const studioActions =
    item && tools?.length && onRunTool
      ? buildCanvasToolActions({ tools, item, pendingToolId, onRunTool })
      : [];

  const menuGroups = buildInfiniteNodeMenuGroups(node, handlers);
  const menuActions = infiniteNodeMenuToToolbarActions(menuGroups);

  if (studioActions.length === 0) return menuActions;

  const coveredStudioTools = studioToolIdsFromActions(studioActions);
  const dedupedMenu = menuActions.filter((action) => {
    const menuKey = menuActionStudioKey(action.id);
    if (!menuKey) return true;
    const studioKey = MENU_ACTION_TO_STUDIO_TOOL[menuKey];
    return !studioKey || !coveredStudioTools.has(studioKey);
  });

  return [...studioActions, ...dedupedMenu];
}

/** @deprecated 使用 buildCanvasNodeToolbarActions */
export const buildInfiniteNodeToolbarActions = buildCanvasNodeToolbarActions;
