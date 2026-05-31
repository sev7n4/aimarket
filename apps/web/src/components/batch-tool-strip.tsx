"use client";

import {
  ArrowUpToLine,
  AtSign,
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
  Wand2,
  type LucideIcon,
} from "lucide-react";
import type { CanvasItem } from "@/lib/canvas-tools";
import type { StudioTool } from "@/lib/types";

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

export function batchReferenceItem(
  batchItems: CanvasItem[],
  selectedId: string | null,
): CanvasItem | null {
  const selectedInBatch = selectedId
    ? batchItems.find((i) => i.id === selectedId)
    : null;
  const candidate =
    selectedInBatch ??
    batchItems.find((i) => i.outputId || i.assetId) ??
    null;
  if (!candidate || !(candidate.outputId || candidate.assetId)) return null;
  return candidate;
}

interface BatchToolStripProps {
  tools: StudioTool[];
  batchItems: CanvasItem[];
  selectedId: string | null;
  readOnly?: boolean;
  pendingToolId?: string | null;
  onRunTool: (tool: StudioTool, item: CanvasItem) => void;
  onMentionItem?: (item: CanvasItem) => void;
  onEnterRefineMode?: (itemId: string) => void;
}

export function BatchToolStrip({
  tools,
  batchItems,
  selectedId,
  readOnly = false,
  pendingToolId = null,
  onRunTool,
  onMentionItem,
  onEnterRefineMode,
}: BatchToolStripProps) {
  if (readOnly) return null;

  const referenceItem = batchReferenceItem(batchItems, selectedId);
  if (!referenceItem) return null;

  const visibleTools = tools.filter((t) => !t.clientOnly);
  if (
    visibleTools.length === 0 &&
    !onMentionItem &&
    !onEnterRefineMode
  ) {
    return null;
  }

  return (
    <div
      className="mt-3 border-t border-white/5 pt-3"
      data-testid="canvas-batch-tool-strip"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-500">
          <span className="text-sm leading-none" aria-hidden>
            🎩
          </span>
          <span className="uppercase tracking-wider">AI 工具链</span>
        </div>
        {onEnterRefineMode ? (
          <button
            type="button"
            data-testid="batch-enter-refine"
            title="进入精修模式：单图深度编辑、圈选对比、连续迭代"
            onClick={() => onEnterRefineMode(referenceItem.id)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-orange-400/40 bg-orange-500/15 px-2.5 py-1 text-[11px] font-medium text-orange-100 transition hover:border-orange-300/60 hover:bg-orange-500/25"
          >
            <Wand2 className="size-3.5" strokeWidth={1.6} />
            <span className="whitespace-nowrap">进入精修</span>
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {onMentionItem ? (
          <button
            type="button"
            title="@ 到工作台"
            onClick={() => onMentionItem(referenceItem)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-purple-400/20 bg-purple-500/10 px-2.5 py-1.5 text-[11px] text-purple-100 transition hover:border-purple-300/50 hover:bg-purple-500/20"
          >
            <AtSign className="size-3.5 text-purple-300" strokeWidth={1.6} />
            <span className="whitespace-nowrap">引用</span>
          </button>
        ) : null}
        {visibleTools.map((tool) => {
          const Icon = TOOL_ICONS[tool.id] ?? Sparkles;
          const short = TOOL_SHORT[tool.id] ?? tool.name;
          const isPending = pendingToolId === tool.id;
          const requireMissing =
            tool.requiresSource &&
            !referenceItem.outputId &&
            !referenceItem.assetId;
          return (
            <button
              key={tool.id}
              type="button"
              data-testid={`canvas-batch-tool-${tool.id}`}
              title={tool.description || tool.name}
              disabled={isPending || requireMissing}
              onClick={() => onRunTool(tool, referenceItem)}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-zinc-200 transition hover:border-orange-400/40 hover:bg-orange-500/15 hover:text-orange-100 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin text-orange-300" />
              ) : (
                <Icon className="size-3.5 text-orange-300" strokeWidth={1.6} />
              )}
              <span className="whitespace-nowrap">{short}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
