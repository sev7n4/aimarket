"use client";

import { Loader2 } from "lucide-react";
import type { OverflowIconAction } from "@/components/overflow-icon-row";
import type { CanvasItem } from "@/lib/canvas-tools";
import { studioToolIcon } from "@/lib/studio-tool-icons";
import { OFFLINE_CANVAS_TOOLS } from "@/lib/studio-tool-interaction";
import { toolShortLabel } from "@/lib/studio-tool-meta";
import type { StudioTool } from "@/lib/types";

export function buildCanvasToolActions(opts: {
  tools: StudioTool[];
  item: CanvasItem;
  pendingToolId?: string | null;
  onRunTool?: (tool: StudioTool, item: CanvasItem) => void;
}): OverflowIconAction[] {
  const { tools, item, pendingToolId, onRunTool } = opts;
  const canUseSource = Boolean(item.outputId || item.assetId);
  const actions: OverflowIconAction[] = [];

  const visibleTools = tools
    .filter((t) => !t.clientOnly && !OFFLINE_CANVAS_TOOLS.has(t.id))
    .sort((a, b) => {
      if (a.id === "focus-edit") return -1;
      if (b.id === "focus-edit") return 1;
      return 0;
    });

  for (const tool of visibleTools) {
    const Icon = studioToolIcon(tool.id);
    const requireMissing = tool.requiresSource && !canUseSource;
    const isPending = pendingToolId === tool.id;
    actions.push({
      id: `canvas-batch-tool-${tool.id}`,
      icon: isPending ? Loader2 : Icon,
      title: toolShortLabel(tool.id, tool.name),
      disabled: isPending || requireMissing || !onRunTool,
      spinning: isPending,
      tone: "orange",
      onClick: () => onRunTool?.(tool, item),
    });
  }

  return actions;
}
