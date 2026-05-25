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
    <div className="mt-4 border-t border-white/5 pt-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
        {tools.map((tool) => {
          const Icon = TOOL_ICONS[tool.id] ?? Wand2;
          const active = activeToolId === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(tool)}
              className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-center transition ${
                active
                  ? "border-purple-500/40 bg-purple-500/10 text-white"
                  : "border-white/8 bg-white/[0.02] text-zinc-400 hover:border-white/15 hover:bg-white/[0.05] hover:text-zinc-200"
              } disabled:opacity-50`}
            >
              <Icon className="size-5 shrink-0" strokeWidth={1.5} />
              <span className="text-[11px] leading-tight">{tool.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
