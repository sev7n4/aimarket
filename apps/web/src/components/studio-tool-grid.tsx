"use client";

import { Loader2 } from "lucide-react";
import type { StudioTool } from "@/lib/types";
import {
  STUDIO_TOOL_GRID_ICON_FALLBACK,
  studioToolIcon,
} from "@/lib/studio-tool-icons";
import { TOOL_GRID_HINTS } from "@/lib/studio-tool-meta";

interface StudioToolGridProps {
  tools: StudioTool[];
  activeToolId?: string | null;
  onSelect: (tool: StudioTool) => void;
  disabled?: boolean;
  /** 精修区：展示选中图规格，只读 */
  refineHint?: string | null;
}

export function StudioToolGrid({
  tools,
  activeToolId,
  onSelect,
  disabled,
  refineHint,
}: StudioToolGridProps) {
  if (!tools.length) return null;

  return (
    <div className="mt-3 border-t border-white/5 pt-3">
      <div className="mb-1 flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-1 text-[10px] font-medium text-zinc-500">
          <span className="text-sm leading-none" aria-hidden>
            ✨
          </span>
          <span className="uppercase tracking-wider">精修</span>
        </div>
        {refineHint ? (
          <span className="truncate text-[10px] text-zinc-600">{refineHint}</span>
        ) : null}
      </div>
      <p className="mb-2 px-0.5 text-[10px] leading-relaxed text-zinc-600">
        选中画布图片后使用；参数由工具链决定，不跟随上方「生成」面板。
      </p>
      <div className="flex flex-wrap gap-1.5">
        {tools.map((tool) => {
          const Icon = studioToolIcon(tool.id, STUDIO_TOOL_GRID_ICON_FALLBACK);
          const active = activeToolId === tool.id;
          const isPending = activeToolId === tool.id;
          const subtitle = TOOL_GRID_HINTS[tool.id];
          const recommended =
            tool.id === "expand" || tool.id === "cutout" || tool.id === "variation";
          return (
            <button
              key={tool.id}
              type="button"
              data-testid={`studio-tool-${tool.id}`}
              title={subtitle ? `${tool.name} · ${subtitle}` : tool.description || tool.name}
              disabled={disabled}
              onClick={() => onSelect(tool)}
              className={`group relative flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-lg px-1.5 py-1.5 transition ${
                active
                  ? "bg-orange-500/20 text-orange-300"
                  : "text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
              } disabled:opacity-50`}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Icon className="size-4" strokeWidth={1.5} />
              )}
              <span className="max-w-[4.5rem] truncate text-[9px] leading-tight">
                {tool.name}
              </span>
              {subtitle ? (
                <span className="max-w-[4.5rem] truncate text-[8px] leading-tight text-zinc-600 group-hover:text-zinc-500">
                  {recommended && tool.id !== "variation" ? "推荐 · " : ""}
                  {subtitle.split(" · ")[0]}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
