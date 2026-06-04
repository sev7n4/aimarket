"use client";

import type { ReactNode } from "react";
import { ChevronUp } from "lucide-react";
import type { StudioDockMode } from "@/lib/studio-dock-state";

interface StudioDockProps {
  mode: StudioDockMode;
  onModeChange: (mode: StudioDockMode) => void;
  children: ReactNode;
}

/**
 * Studio 底部 Dock 定位层：只负责贴底居中，视觉与控件全部由 CreationPanel 承担。
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
          onClick={() => onModeChange("expanded")}
          className="pointer-events-auto group flex min-w-[4.5rem] flex-col items-center gap-1 rounded-t-2xl rounded-b-xl border border-white/10 bg-gradient-to-b from-zinc-900/75 to-zinc-950/90 px-4 py-2 text-zinc-400 shadow-[0_-10px_36px_rgba(0,0,0,0.45),0_0_28px_rgba(249,115,22,0.08)] backdrop-blur-xl backdrop-saturate-150 transition hover:border-white/15 hover:from-zinc-900/85 hover:to-zinc-950/95 hover:text-zinc-200"
          aria-label="展开创作台"
          title="展开创作台（⌘J）"
        >
          <span
            className="h-0.5 w-8 rounded-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition group-hover:via-white/50"
            aria-hidden
          />
          <ChevronUp
            className="size-4 text-orange-400/90 transition group-hover:text-orange-300"
            strokeWidth={2.25}
          />
          <span className="text-[10px] font-medium text-zinc-500 transition group-hover:text-zinc-300">
            创作台
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] sm:px-4"
      aria-label="创作 Dock"
      data-dock-mode={mode}
    >
      <div className="w-full max-w-3xl drop-shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        {children}
      </div>
    </div>
  );
}

/** 画布容器不再预留底部空白，背景直接贴底；Dock 浮层叠在上方 */
export function studioDockCanvasPadding(_mode: StudioDockMode): string {
  return "";
}

/** 滚动内容底部留白，避免最后一批图片被 Dock 挡住 */
export function studioDockScrollInset(mode: StudioDockMode): string {
  if (mode === "focus") return "pb-[4.75rem] sm:pb-20";
  return "pb-28 sm:pb-32";
}
