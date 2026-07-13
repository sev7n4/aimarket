"use client";

import { useState } from "react";
import { ChevronLeft, ImageIcon, Wrench } from "lucide-react";
import { cn } from "@aimarket/ui";
import type { CanvasItem } from "@/lib/canvas-tools";
import type { WorkflowToolId } from "@/lib/workflow-tool-registry";
import { AssetPanel } from "@/components/infinite-canvas/AssetPanel";
import { WorkflowToolPalette } from "./WorkflowToolPalette";

type WorkflowLeftPanelTab = "tools" | "assets";

type WorkflowLeftPanelProps = {
  items: CanvasItem[];
  onAddTool: (toolId: WorkflowToolId) => void;
  onApplyAsset: (itemId: string) => void;
  readOnly?: boolean;
};

export function WorkflowLeftPanel({
  items,
  onAddTool,
  onApplyAsset,
  readOnly = false,
}: WorkflowLeftPanelProps) {
  const [tab, setTab] = useState<WorkflowLeftPanelTab>("tools");
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <aside
        data-testid="workflow-left-panel"
        className="z-20 flex w-10 shrink-0 flex-col border-r border-white/10 bg-[#0a0a0a]/95 backdrop-blur-sm"
        aria-label="工作流侧栏"
      >
        <button
          type="button"
          aria-label="展开侧栏"
          title="展开侧栏"
          data-testid="workflow-left-panel-expand"
          onClick={() => setCollapsed(false)}
          className="flex size-10 items-center justify-center text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
        >
          <Wrench className="size-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      data-testid="workflow-left-panel"
      className="z-20 flex w-52 shrink-0 flex-col border-r border-white/10 bg-[#0a0a0a]/95 backdrop-blur-sm"
      aria-label="工作流侧栏"
    >
      <div className="flex items-center border-b border-white/10">
        <button
          type="button"
          data-testid="workflow-left-tab-tools"
          onClick={() => setTab("tools")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-semibold transition",
            tab === "tools"
              ? "border-b-2 border-violet-400 text-zinc-100"
              : "text-zinc-500 hover:text-zinc-300",
          )}
        >
          <Wrench className="size-3.5 shrink-0 text-violet-400" />
          工具
        </button>
        <button
          type="button"
          data-testid="workflow-left-tab-assets"
          onClick={() => setTab("assets")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-semibold transition",
            tab === "assets"
              ? "border-b-2 border-violet-400 text-zinc-100"
              : "text-zinc-500 hover:text-zinc-300",
          )}
        >
          <ImageIcon className="size-3.5 shrink-0 text-violet-400" />
          资产
        </button>
        <button
          type="button"
          aria-label="收起侧栏"
          title="收起侧栏"
          data-testid="workflow-left-panel-collapse"
          onClick={() => setCollapsed(true)}
          className="px-2 py-2.5 text-zinc-500 transition hover:text-zinc-300"
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>
      {tab === "tools" ? (
        <WorkflowToolPalette onAddTool={onAddTool} readOnly={readOnly} embedded />
      ) : (
        <AssetPanel items={items} onApply={onApplyAsset} readOnly={readOnly} />
      )}
    </aside>
  );
}
