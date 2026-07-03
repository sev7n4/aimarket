"use client";

import { X } from "lucide-react";
import { MultiCamGrid } from "@/components/multi-cam-grid";
import { StoryboardEvolveGrid } from "@/components/storyboard-evolve-grid";
import { Turnaround360Viewer } from "@/components/turnaround-360-viewer";
import {
  gridLayoutForTool,
  labelsForToolGrid,
  titleForToolGrid,
  type ToolGridToolId,
} from "@/lib/tool-grid-labels";

export type ToolGridResultState = {
  toolId: ToolGridToolId;
  urls: string[];
  referenceUrl?: string;
};

interface ToolGridResultPanelProps {
  result: ToolGridResultState;
  onClose: () => void;
}

export function ToolGridResultPanel({
  result,
  onClose,
}: ToolGridResultPanelProps) {
  const labels = labelsForToolGrid(result.toolId, result.urls.length);
  const { cols, rows } = gridLayoutForTool(result.toolId);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      data-testid="tool-grid-result-panel"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-medium text-zinc-100">
            {titleForToolGrid(result.toolId)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          {result.toolId === "storyboard-evolve" ? (
            <StoryboardEvolveGrid
              cells={labels.map((label, i) => ({
                label,
                url: result.urls[i],
              }))}
            />
          ) : result.toolId === "turnaround-360" ? (
            <Turnaround360Viewer
              referenceUrl={result.referenceUrl}
              angles={labels.map((label, i) => ({
                label,
                labelEn: label,
                url: result.urls[i],
              }))}
            />
          ) : (
            <MultiCamGrid
              cols={cols}
              rows={rows}
              cells={labels.map((label, i) => ({
                label,
                url: result.urls[i],
              }))}
            />
          )}
        </div>
      </div>
    </div>
  );
}
