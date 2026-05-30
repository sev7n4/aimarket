"use client";

import {
  ArrowUpToLine,
  AtSign,
  Brush,
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
import type { StudioTool } from "@/lib/types";

const TOOL_ICONS: Record<string, LucideIcon> = {
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
      <div className="mb-2 flex items-center gap-1 px-0.5 text-[10px] font-medium text-zinc-500">
        <span className="text-sm leading-none" aria-hidden>
          🎩
        </span>
        <span className="uppercase tracking-wider">工具</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {tools.map((tool) => {
          const Icon = TOOL_ICONS[tool.id] ?? Wand2;
          const active = activeToolId === tool.id;
          const isPending = activeToolId === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              data-testid={`studio-tool-${tool.id}`}
              title={tool.description || tool.name}
              disabled={disabled}
              onClick={() => onSelect(tool)}
              className={`group relative flex size-8 items-center justify-center rounded-lg transition ${
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
              <span className="pointer-events-none absolute -top-8 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-800 px-2 py-1 text-[10px] text-zinc-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                {tool.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
