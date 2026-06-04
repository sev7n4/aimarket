"use client";

import {
  ArrowUpToLine,
  Brush,
  Copy,
  Crop,
  Crosshair,
  Eraser,
  Layers,
  Loader2,
  Maximize2,
  Scissors,
  Sparkles,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { CanvasItem } from "@/lib/canvas-tools";
import type { StudioTool } from "@/lib/types";
import type { OverflowIconAction } from "@/components/overflow-icon-row";

const TOOL_ICONS: Record<string, LucideIcon> = {
  variation: Copy,
  expand: Maximize2,
  erase: Eraser,
  cutout: Scissors,
  inpaint: Brush,
  "focus-edit": Crosshair,
  text: Type,
  upscale: ArrowUpToLine,
  enhance: Sparkles,
  blend: Layers,
  crop: Crop,
};

const TOOL_SHORT: Record<string, string> = {
  variation: "变体",
  expand: "扩图",
  erase: "消除",
  cutout: "抠图",
  inpaint: "局改",
  "focus-edit": "焦点",
  text: "改字",
  upscale: "超清",
  enhance: "变清",
  blend: "融合",
  crop: "裁剪",
};

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
    .filter((t) => !t.clientOnly)
    .sort((a, b) => {
      if (a.id === "focus-edit") return -1;
      if (b.id === "focus-edit") return 1;
      return 0;
    });

  for (const tool of visibleTools) {
    const Icon = TOOL_ICONS[tool.id] ?? Sparkles;
    const requireMissing = tool.requiresSource && !canUseSource;
    const isPending = pendingToolId === tool.id;
    actions.push({
      id: `canvas-batch-tool-${tool.id}`,
      icon: isPending ? Loader2 : Icon,
      title: TOOL_SHORT[tool.id] ?? tool.name,
      disabled: isPending || requireMissing || !onRunTool,
      spinning: isPending,
      tone: "orange",
      onClick: () => onRunTool?.(tool, item),
    });
  }

  return actions;
}
