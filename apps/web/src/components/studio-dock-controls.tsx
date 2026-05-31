"use client";

import { ChevronDown } from "lucide-react";
import type { StudioDockMode } from "@/lib/studio-dock-state";

const ghostIconBtn =
  "flex items-center justify-center text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300";

interface StudioDockFocusButtonProps {
  onModeChange: (mode: StudioDockMode) => void;
}

/** 收缩 Dock（专注画布）— 贴卡片右上角，无边框 */
export function StudioDockFocusButton({
  onModeChange,
}: StudioDockFocusButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onModeChange("focus")}
      className={`absolute right-1.5 top-1.5 z-10 size-7 rounded-md ${ghostIconBtn}`}
      aria-label="专注画布"
      title="专注画布"
    >
      <ChevronDown className="size-3.5" strokeWidth={1.75} />
    </button>
  );
}
