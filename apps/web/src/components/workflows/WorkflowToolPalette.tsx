"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import { cn } from "@aimarket/ui";
import {
  listWorkflowToolsByCategory,
  type WorkflowToolId,
} from "@/lib/workflow-tool-registry";

type WorkflowToolPaletteProps = {
  onAddTool: (toolId: WorkflowToolId) => void;
  readOnly?: boolean;
};

export function WorkflowToolPalette({
  onAddTool,
  readOnly = false,
}: WorkflowToolPaletteProps) {
  const groups = listWorkflowToolsByCategory();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <aside
      data-testid="workflow-tool-palette"
      className="z-20 flex w-52 shrink-0 flex-col border-r border-white/10 bg-[#0a0a0a]/95 backdrop-blur-sm"
      aria-label="工作流工具"
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
        <Wrench className="size-4 text-violet-400" />
        <span className="text-xs font-semibold text-zinc-200">工具节点</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {groups.map((group) => {
          const isCollapsed = collapsed[group.category] ?? false;
          return (
            <div key={group.category} className="mb-2">
              <button
                type="button"
                className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-[11px] font-medium text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
                onClick={() =>
                  setCollapsed((prev) => ({
                    ...prev,
                    [group.category]: !isCollapsed,
                  }))
                }
              >
                {isCollapsed ? (
                  <ChevronRight className="size-3.5 shrink-0" />
                ) : (
                  <ChevronDown className="size-3.5 shrink-0" />
                )}
                {group.label}
              </button>
              {!isCollapsed ? (
                <ul className="mt-0.5 space-y-0.5">
                  {group.tools.map((tool) => (
                    <li key={tool.id}>
                      <button
                        type="button"
                        disabled={readOnly}
                        data-testid={`workflow-tool-${tool.id}`}
                        title={tool.description}
                        onClick={() => onAddTool(tool.id)}
                        className={cn(
                          "w-full rounded-md px-2 py-2 text-left transition",
                          readOnly
                            ? "cursor-not-allowed opacity-40"
                            : "hover:bg-violet-500/10 hover:text-violet-100",
                        )}
                      >
                        <span className="block text-xs font-medium text-zinc-200">
                          {tool.label}
                        </span>
                        <span className="mt-0.5 block text-[10px] leading-snug text-zinc-500">
                          {tool.description}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
