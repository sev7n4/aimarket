"use client";

import type { CanvasItem } from "@/lib/canvas-tools";
import { Eye, Trash2, Wand2, RotateCcw } from "lucide-react";

export interface ImageActionBarProps {
  item: CanvasItem;
  onPreview: () => void;
  onRefine: () => void;
  onRerun: () => void;
  onDelete: () => void;
  selected?: boolean;
}

export function ImageActionBar({
  onPreview,
  onRefine,
  onRerun,
  onDelete,
  selected,
}: ImageActionBarProps) {
  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-1 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 py-2 transition-opacity ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPreview();
        }}
        className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs text-zinc-300 transition hover:bg-white/20 hover:text-white"
        title="预览"
      >
        <Eye className="size-3.5" />
        <span>预览</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRefine();
        }}
        className="flex items-center gap-1 rounded-md bg-orange-500/20 px-2 py-1 text-xs text-orange-300 transition hover:bg-orange-500/30 hover:text-orange-100"
        title="精修"
      >
        <Wand2 className="size-3.5" />
        <span>精修</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRerun();
        }}
        className="flex items-center gap-1 rounded-md bg-blue-500/20 px-2 py-1 text-xs text-blue-300 transition hover:bg-blue-500/30 hover:text-blue-100"
        title="重跑"
      >
        <RotateCcw className="size-3.5" />
        <span>重跑</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="flex items-center gap-1 rounded-md bg-red-500/20 px-2 py-1 text-xs text-red-300 transition hover:bg-red-500/30 hover:text-red-100"
        title="删除"
      >
        <Trash2 className="size-3.5" />
        <span>删除</span>
      </button>
    </div>
  );
}
