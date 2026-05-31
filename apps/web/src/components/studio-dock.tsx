"use client";

import type { ReactNode } from "react";
import {
  ChevronDown,
  Maximize2,
  Minimize2,
  PanelBottomOpen,
} from "lucide-react";
import type { StudioDockMode } from "@/lib/studio-dock-state";

interface StudioDockProps {
  mode: StudioDockMode;
  onModeChange: (mode: StudioDockMode) => void;
  children: ReactNode;
}

/**
 * Studio 底部创作 Dock：compact / expanded / focus 三态。
 */
export function StudioDock({ mode, onModeChange, children }: StudioDockProps) {
  if (mode === "focus") {
    return (
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        aria-label="创作 Dock"
      >
        <button
          type="button"
          onClick={() => onModeChange("compact")}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-[#0a0a0a]/90 px-4 py-2 text-xs text-zinc-300 shadow-xl backdrop-blur-md transition hover:bg-white/5 hover:text-white"
          aria-label="展开创作输入栏"
          title="展开输入栏（⌘J）"
        >
          <PanelBottomOpen className="size-3.5" />
          展开输入
        </button>
      </div>
    );
  }

  const expanded = mode === "expanded";

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-40 flex justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-4"
      aria-label="创作 Dock"
      data-dock-mode={mode}
    >
      <div
        className={`flex w-full max-w-3xl flex-col rounded-2xl border border-white/10 bg-[#0b0b0b]/95 shadow-2xl shadow-black/50 backdrop-blur-md transition-all ${
          expanded ? "max-h-[min(50vh,520px)]" : "max-h-none"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-3 py-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            创作
          </span>
          <div className="flex items-center gap-0.5">
            {!expanded ? (
              <button
                type="button"
                onClick={() => onModeChange("expanded")}
                className="flex size-7 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-white"
                aria-label="展开更多选项"
                title="展开模型与参数（⌘J）"
              >
                <ChevronDown className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onModeChange("compact")}
                className="flex size-7 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-white"
                aria-label="收起为紧凑模式"
                title="收起（⌘J）"
              >
                <Maximize2 className="size-3.5 rotate-180" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onModeChange("focus")}
              className="flex size-7 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-white"
              aria-label="专注画布"
              title="专注画布（隐藏输入栏）"
            >
              <Minimize2 className="size-3.5" />
            </button>
          </div>
        </div>
        <div
          className={`min-h-0 ${expanded ? "overflow-y-auto overscroll-contain" : ""}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/** 画布底部留白，避免内容被 Dock 遮挡 */
export function studioDockCanvasPadding(mode: StudioDockMode): string {
  switch (mode) {
    case "focus":
      return "pb-16";
    case "expanded":
      return "pb-[min(52vh,540px)]";
    default:
      return "pb-28 sm:pb-32";
  }
}
