"use client";

import {
  Crop,
  Eraser,
  Expand,
  Layers,
  Pencil,
  Type,
  Video,
  Wand2,
} from "lucide-react";
import type { StudioTool } from "@/lib/types";

const TOOL_ICONS: Record<string, typeof Expand> = {
  expand: Expand,
  erase: Eraser,
  inpaint: Pencil,
  text: Type,
  crop: Crop,
  blend: Layers,
  video: Video,
};

interface StudioToolGridProps {
  tools: StudioTool[];
  activeToolId?: string | null;
  onSelect: (tool: StudioTool) => void;
  disabled?: boolean;
}

export function StudioToolGrid({
  tools,
  activeToolId,
  onSelect,
  disabled,
}: StudioToolGridProps) {
  if (!tools.length) return null;

  return (
    <div className="mt-3 border-t border-white/5 pt-3">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
        AI 工具
      </p>
      <div className="-mx-1 flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:pb-0 lg:grid-cols-7 [&::-webkit-scrollbar]:hidden">
        {tools.map((tool) => {
          const Icon = TOOL_ICONS[tool.id] ?? Wand2;
          const active = activeToolId === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(tool)}
              className={`flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 rounded-2xl border px-2 py-2.5 text-center transition md:w-auto ${
                active
                  ? "border-purple-500/40 bg-purple-500/10 text-white"
                  : "border-white/8 bg-white/[0.02] text-zinc-400 hover:border-white/15 hover:bg-white/[0.05] hover:text-zinc-200"
              } disabled:opacity-50`}
            >
              <Icon className="size-5 shrink-0" strokeWidth={1.5} />
              <span className="text-[10px] leading-tight">{tool.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
