"use client";

import { canvasTools, type CanvasToolId } from "@/lib/canvas-tools";

interface CanvasToolbarProps {
  active: CanvasToolId;
  gridOn: boolean;
  onTool: (id: CanvasToolId) => void;
  layout?: "vertical" | "horizontal";
}

export function CanvasToolbar({
  active,
  gridOn,
  onTool,
  layout = "vertical",
}: CanvasToolbarProps) {
  if (layout === "horizontal") {
    return (
      <div className="shrink-0 border-t border-white/5 bg-[#080808]">
        <div className="flex items-center gap-0.5 overflow-x-auto px-2 py-2 scrollbar-none">
          {canvasTools.map((tool) => {
            const Icon = tool.icon;
            const isGrid = tool.id === "grid";
            const isActive = isGrid ? gridOn : active === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                title={tool.label}
                onClick={() => onTool(tool.id)}
                className={`flex size-10 shrink-0 items-center justify-center rounded-lg transition ${
                  isActive
                    ? "bg-white/15 text-white"
                    : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                }`}
              >
                <Icon className="size-4" strokeWidth={1.5} />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-white/5 bg-[#080808] py-3">
      <span className="mb-2 text-[9px] font-medium uppercase tracking-wider text-zinc-600 [writing-mode:vertical-rl]">
        画布
      </span>
      {canvasTools.map((tool) => {
        const Icon = tool.icon;
        const isGrid = tool.id === "grid";
        const isActive = isGrid ? gridOn : active === tool.id;
        return (
          <button
            key={tool.id}
            type="button"
            title={tool.label}
            onClick={() => onTool(tool.id)}
            className={`flex size-9 items-center justify-center rounded-lg transition ${
              isActive
                ? "bg-white/15 text-white"
                : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            }`}
          >
            <Icon className="size-4" strokeWidth={1.5} />
          </button>
        );
      })}
    </div>
  );
}
