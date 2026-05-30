"use client";

import { canvasTools, type CanvasToolId, type CanvasLayoutMode } from "@/lib/canvas-tools";

interface CanvasToolbarProps {
  active: CanvasToolId;
  gridOn: boolean;
  onTool: (id: CanvasToolId) => void;
  layout?: "vertical" | "horizontal";
  layoutMode?: CanvasLayoutMode;
  canUndo?: boolean;
  canRedo?: boolean;
}

export function CanvasToolbar({
  active,
  gridOn,
  onTool,
  layout = "vertical",
  layoutMode = "scroll",
  canUndo = false,
  canRedo = false,
}: CanvasToolbarProps) {
  const canvasOnlyTools = ["pan", "zoom-in", "zoom-out", "grid", "fit"];
  const hiddenInScroll = ["pan", "zoom-in", "zoom-out", "grid", "fit", "layout-scroll", "layout-free"];

  const filteredTools = canvasTools.filter((tool) => {
    if (layoutMode === "scroll" && hiddenInScroll.includes(tool.id)) return false;
    if (tool.id === "undo" && !canUndo) return false;
    if (tool.id === "redo" && !canRedo) return false;
    if (tool.id === "layout-scroll" && layoutMode === "scroll") return false;
    if (tool.id === "layout-free" && layoutMode === "free") return false;
    return true;
  });

  if (layout === "horizontal") {
    return (
      <div className="shrink-0 border-t border-white/5 bg-[#080808]">
        <div className="flex items-center gap-0.5 overflow-x-auto px-2 py-2 scrollbar-none">
          {filteredTools.map((tool) => {
            const Icon = tool.icon;
            const isGrid = tool.id === "grid";
            const isUndo = tool.id === "undo";
            const isRedo = tool.id === "redo";
            const isActive = isGrid ? gridOn : active === tool.id;
            const isDisabled = (isUndo && !canUndo) || (isRedo && !canRedo);
            return (
              <button
                key={tool.id}
                type="button"
                title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
                onClick={() => onTool(tool.id)}
                disabled={isDisabled}
                className={`flex size-10 shrink-0 items-center justify-center rounded-lg transition ${
                  isDisabled
                    ? "text-zinc-600 opacity-40"
                    : isActive
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
      {filteredTools.map((tool) => {
        const Icon = tool.icon;
        const isGrid = tool.id === "grid";
        const isUndo = tool.id === "undo";
        const isRedo = tool.id === "redo";
        const isActive = isGrid ? gridOn : active === tool.id;
        const isDisabled = (isUndo && !canUndo) || (isRedo && !canRedo);
        return (
          <button
            key={tool.id}
            type="button"
            title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
            onClick={() => onTool(tool.id)}
            disabled={isDisabled}
            className={`flex size-9 items-center justify-center rounded-lg transition ${
              isDisabled
                ? "text-zinc-600 opacity-40"
                : isActive
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
