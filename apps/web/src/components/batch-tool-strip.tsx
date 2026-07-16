"use client";

import { AtSign, Loader2 } from "lucide-react";
import type { CanvasItem } from "@/lib/canvas-tools";
import { studioToolIcon } from "@/lib/studio-tool-icons";
import { toolShortLabel } from "@/lib/studio-tool-meta";
import type { StudioTool } from "@/lib/types";

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
}

export function BatchToolStrip({
  tools,
  batchItems,
  selectedId,
  readOnly = false,
  pendingToolId = null,
  onRunTool,
  onMentionItem,
}: BatchToolStripProps) {
  if (readOnly) return null;

  const referenceItem = batchReferenceItem(batchItems, selectedId);
  if (!referenceItem) return null;

  const visibleTools = tools.filter((t) => !t.clientOnly);
  if (visibleTools.length === 0 && !onMentionItem) {
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
          const Icon = studioToolIcon(tool.id);
          const short = toolShortLabel(tool.id, tool.name);
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
