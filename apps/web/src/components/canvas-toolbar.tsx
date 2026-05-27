"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { canvasTools, type CanvasToolId } from "@/lib/canvas-tools";

interface CanvasToolbarProps {
  active: CanvasToolId;
  gridOn: boolean;
  onTool: (id: CanvasToolId) => void;
  layout?: "vertical" | "horizontal";
}

/**
 * 移动端主级保留：选择 / 适应 / 上传 / 下载（4 个高频）
 * 二级折叠：移动画布 / 放大 / 缩小 / 删除 / 网格
 * （双指 pinch 已可缩放，所以放大/缩小默认隐藏）
 */
const PRIMARY_IDS_MOBILE: CanvasToolId[] = ["select", "fit", "upload", "download"];

export function CanvasToolbar({
  active,
  gridOn,
  onTool,
  layout = "vertical",
}: CanvasToolbarProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  if (layout === "horizontal") {
    const primary = canvasTools.filter((t) => PRIMARY_IDS_MOBILE.includes(t.id));
    const secondary = canvasTools.filter(
      (t) => !PRIMARY_IDS_MOBILE.includes(t.id),
    );
    return (
      <div className="relative shrink-0 border-t border-white/5 bg-[#080808]">
        <div className="flex items-center gap-0.5 overflow-x-auto px-2 py-2 scrollbar-none">
          {primary.map((tool) => {
            const Icon = tool.icon;
            const isActive = active === tool.id;
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
          <button
            type="button"
            title="更多"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className={`ml-auto flex size-10 shrink-0 items-center justify-center rounded-lg transition ${
              moreOpen
                ? "bg-white/15 text-white"
                : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            }`}
          >
            <MoreHorizontal className="size-4" strokeWidth={1.5} />
          </button>
        </div>
        {moreOpen ? (
          <div className="absolute bottom-full right-2 z-30 mb-2 flex gap-1 rounded-xl border border-white/10 bg-[#101010] p-1 shadow-xl">
            {secondary.map((tool) => {
              const Icon = tool.icon;
              const isGrid = tool.id === "grid";
              const isActive = isGrid ? gridOn : active === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  title={tool.label}
                  onClick={() => {
                    onTool(tool.id);
                    if (tool.id !== "grid") setMoreOpen(false);
                  }}
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
        ) : null}
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
