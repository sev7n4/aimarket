"use client";

import { AtSign, Loader2 } from "lucide-react";
import type { CanvasItem } from "@/lib/canvas-tools";
import { studioToolIcon } from "@/lib/studio-tool-icons";
import { OFFLINE_CANVAS_TOOLS } from "@/lib/studio-tool-interaction";
import { toolShortLabel } from "@/lib/studio-tool-meta";
import type { StudioTool } from "@/lib/types";

interface CanvasSelectionToolbarProps {
  tools: StudioTool[];
  selectedItem: CanvasItem | null;
  readOnly?: boolean;
  pendingToolId?: string | null;
  layout: "vertical" | "horizontal";
  onRunTool: (tool: StudioTool, item: CanvasItem) => void;
  onMentionItem?: (item: CanvasItem) => void;
}

export function CanvasSelectionToolbar({
  tools,
  selectedItem,
  readOnly = false,
  pendingToolId = null,
  layout,
  onRunTool,
  onMentionItem,
}: CanvasSelectionToolbarProps) {
  if (!selectedItem || readOnly) return null;
  const hasSource = Boolean(selectedItem.outputId || selectedItem.assetId);
  if (!hasSource) return null;

  const visibleTools = tools.filter(
    (t) => !t.clientOnly && !OFFLINE_CANVAS_TOOLS.has(t.id),
  );

  if (visibleTools.length === 0 && !onMentionItem) return null;

  if (layout === "vertical") {
    return (
      <div className="pointer-events-auto absolute right-3 top-3 z-20 flex max-h-[calc(100%-1.5rem)] flex-col items-center gap-1 overflow-y-auto rounded-2xl border border-white/10 bg-[#0d0d0d]/95 p-1.5 shadow-2xl backdrop-blur scrollbar-none">
        <div className="flex items-center gap-1 px-0.5 pb-1 pt-0.5 text-[10px] font-medium text-zinc-500">
          <span className="text-sm leading-none" aria-hidden>
            🎩
          </span>
        </div>
        {onMentionItem ? (
          <button
            type="button"
            title="@ 到工作台"
            onClick={() => onMentionItem(selectedItem)}
            className="group relative flex size-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-purple-500/15 hover:text-purple-300"
          >
            <AtSign className="size-4" strokeWidth={1.5} />
            <span className="pointer-events-none absolute -left-1 top-full z-50 mt-1 whitespace-nowrap rounded-md bg-zinc-800 px-2 py-1 text-[10px] text-zinc-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              @ 引用
            </span>
          </button>
        ) : null}
        {visibleTools.map((tool) => {
          const Icon = studioToolIcon(tool.id);
          const isPending = pendingToolId === tool.id;
          const requireMissing =
            tool.requiresSource && !selectedItem.outputId && !selectedItem.assetId;
          return (
            <button
              key={tool.id}
              type="button"
              data-testid={`canvas-tool-${tool.id}`}
              title={tool.description || tool.name}
              disabled={isPending || requireMissing}
              onClick={() => onRunTool(tool, selectedItem)}
              className="group relative flex size-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/10 hover:text-zinc-300 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin text-orange-300" />
              ) : (
                <Icon className="size-4" strokeWidth={1.5} />
              )}
              <span className="pointer-events-none absolute -left-1 top-full z-50 mt-1 whitespace-nowrap rounded-md bg-zinc-800 px-2 py-1 text-[10px] text-zinc-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                {toolShortLabel(tool.id, tool.name)}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="pointer-events-auto absolute left-2 right-2 top-2 z-20">
      <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-[#0d0d0d]/95 px-2 py-1.5 shadow-xl backdrop-blur scrollbar-none">
        <span className="flex shrink-0 items-center pl-1 pr-1 text-base leading-none" aria-label="工具">
          🎩
        </span>
        {onMentionItem ? (
          <button
            type="button"
            title="@ 到工作台"
            onClick={() => onMentionItem(selectedItem)}
            className="group flex shrink-0 items-center gap-1.5 rounded-full border border-purple-400/20 bg-purple-500/10 px-2.5 py-1.5 text-[11px] text-purple-100 transition hover:border-purple-300/50 hover:bg-purple-500/20"
          >
            <AtSign className="size-3.5 text-purple-300" strokeWidth={1.6} />
            <span className="whitespace-nowrap">引用</span>
          </button>
        ) : null}
        {visibleTools.map((tool) => {
          const Icon = studioToolIcon(tool.id);
          const short = toolShortLabel(tool.id, tool.name);
          const isPending = pendingToolId === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              data-testid={`canvas-tool-${tool.id}`}
              title={tool.description || tool.name}
              disabled={isPending}
              onClick={() => onRunTool(tool, selectedItem)}
              className="group flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-zinc-200 transition hover:border-orange-400/40 hover:bg-orange-500/15 hover:text-orange-100 disabled:opacity-50"
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
