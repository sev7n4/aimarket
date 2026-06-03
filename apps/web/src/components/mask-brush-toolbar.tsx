"use client";

import { Eraser, Redo2, RotateCcw, Undo2 } from "lucide-react";

interface MaskBrushToolbarProps {
  title: string;
  brushSize: number;
  brushSizeMin: number;
  brushSizeMax: number;
  onBrushSizeChange: (size: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onComplete: () => void;
  onCancel: () => void;
  completeLabel?: string;
  hint?: string;
}

export function MaskBrushToolbar({
  title,
  brushSize,
  brushSizeMin,
  brushSizeMax,
  onBrushSizeChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  onComplete,
  onCancel,
  completeLabel = "完成圈选",
  hint = "在图片上涂抹要处理的区域；可用滑块调节画笔粗细。",
}: MaskBrushToolbarProps) {
  return (
    <div className="absolute left-2 right-2 top-2 z-30 rounded-2xl border border-purple-400/30 bg-black/80 p-2.5 text-xs text-zinc-200 shadow-xl backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 font-medium text-purple-200">
          <Eraser className="size-3.5" strokeWidth={1.6} />
          {title}
        </span>
        <button
          type="button"
          disabled={!canUndo}
          onClick={onUndo}
          className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-zinc-300 disabled:opacity-40"
          title="撤销"
        >
          <Undo2 className="size-3" />
          撤销
        </button>
        <button
          type="button"
          disabled={!canRedo}
          onClick={onRedo}
          className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-zinc-300 disabled:opacity-40"
          title="重做"
        >
          <Redo2 className="size-3" />
          重做
        </button>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-zinc-300"
          title="清空涂抹"
        >
          <RotateCcw className="size-3" />
          清空
        </button>
        <button
          type="button"
          onClick={onComplete}
          className="ml-auto rounded-full bg-purple-500 px-3 py-1 font-medium text-white"
        >
          {completeLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full bg-white/10 px-2.5 py-1 text-zinc-300"
        >
          取消
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="shrink-0 text-[10px] text-zinc-500">画笔</span>
        <input
          type="range"
          min={brushSizeMin}
          max={brushSizeMax}
          value={brushSize}
          onChange={(e) => onBrushSizeChange(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer accent-purple-400"
          aria-label="画笔粗细"
        />
        <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-zinc-400">
          {brushSize}
        </span>
      </div>
      {hint ? (
        <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
}
