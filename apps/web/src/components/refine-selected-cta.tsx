"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { hapticLight } from "@/lib/haptics";

const DISMISS_KEY = "aimarket_refine_selected_cta_dismissed";

interface RefineSelectedCtaProps {
  onRefine: () => void;
}

export function RefineSelectedCta({ onRefine }: RefineSelectedCtaProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(localStorage.getItem(DISMISS_KEY) !== "1");
  }, []);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  return (
    <div
      className="absolute inset-x-1 bottom-9 z-30 flex items-end justify-center gap-1"
      data-testid="refine-selected-cta"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex max-w-full flex-col items-center gap-0.5">
        <div className="flex max-w-full items-center gap-1 rounded-lg border border-orange-400/40 bg-gradient-to-r from-orange-500/90 to-orange-600/90 px-1 py-1 shadow-lg shadow-orange-950/40">
        <button
          type="button"
          onClick={() => {
            onRefine();
            hapticLight();
          }}
          className="flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-white transition hover:bg-white/15"
          title="进入精修模式：圈选、对比、连续迭代"
        >
          <Sparkles className="size-3.5 shrink-0" />
          <span className="truncate">精修此图</span>
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-orange-100/80 transition hover:bg-white/15 hover:text-white"
          title="不再提示"
          aria-label="关闭精修提示"
        >
          <X className="size-3.5" />
        </button>
        </div>
        <p className="text-[10px] text-zinc-500">双击图片可预览大图</p>
      </div>
    </div>
  );
}
