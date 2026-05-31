"use client";

import { useCallback, useRef, useState } from "react";
import { assetUrl } from "@/lib/api-client";
import type { CanvasItem } from "@/lib/canvas-tools";
import { Columns2, X } from "lucide-react";

interface RefineCompareViewProps {
  before: CanvasItem;
  after: CanvasItem;
  onClose: () => void;
}

export function RefineCompareView({
  before,
  after,
  onClose,
}: RefineCompareViewProps) {
  const [split, setSplit] = useState(50);
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateSplit = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSplit(Math.min(98, Math.max(2, pct)));
  }, []);

  return (
    <div
      className="pointer-events-auto absolute inset-3 z-30 flex flex-col overflow-hidden rounded-2xl border border-orange-400/30 bg-black/90 shadow-2xl backdrop-blur"
      data-testid="refine-compare-view"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-zinc-200">
          <Columns2 className="size-3.5 text-orange-300" />
          <span>Before / After 对比</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/10 hover:text-white"
          title="关闭对比"
        >
          <X className="size-4" />
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 select-none overflow-hidden"
        onPointerDown={(e) => {
          dragging.current = true;
          updateSplit(e.clientX);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          updateSplit(e.clientX);
        }}
        onPointerUp={(e) => {
          dragging.current = false;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
      >
        <img
          src={assetUrl(before.url)}
          alt="精修前"
          className="absolute inset-0 size-full object-contain"
          draggable={false}
        />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 0 0 ${split}%)` }}
        >
          <img
            src={assetUrl(after.url)}
            alt="精修后"
            className="size-full object-contain"
            draggable={false}
          />
        </div>
        <div
          className="absolute inset-y-0 z-10 w-0.5 bg-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.6)]"
          style={{ left: `${split}%` }}
        >
          <div className="absolute left-1/2 top-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-orange-300/50 bg-black/80 text-orange-200">
            ↔
          </div>
        </div>
        <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-zinc-300">
          精修前
        </span>
        <span className="pointer-events-none absolute right-3 top-3 rounded-md bg-orange-500/80 px-2 py-0.5 text-[10px] text-white">
          精修后
        </span>
      </div>
    </div>
  );
}
