"use client";

import type { ReactNode } from "react";
import type { CanvasItem } from "@/lib/canvas-tools";
import {
  Sparkles,
  Wand2,
  Expand,
  Crop,
  Eraser,
  Eye,
  Trash2,
  RotateCcw,
  Maximize2,
  Scissors,
  Pencil,
  ZoomIn,
  CircleDot,
  Layers,
  Move,
  Grid3X3,
  Layout,
} from "lucide-react";

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
      className={`absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 py-2 transition-opacity ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPreview();
        }}
        className="flex items-center justify-center rounded-full bg-white/10 p-2 text-zinc-300 transition hover:bg-white/20 hover:text-white"
        title="预览"
      >
        <Eye className="size-4" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRefine();
        }}
        className="flex items-center justify-center rounded-full bg-orange-500/20 p-2 text-orange-300 transition hover:bg-orange-500/30 hover:text-orange-100"
        title="精修"
      >
        <Wand2 className="size-4" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRerun();
        }}
        className="flex items-center justify-center rounded-full bg-blue-500/20 p-2 text-blue-300 transition hover:bg-blue-500/30 hover:text-blue-100"
        title="重跑"
      >
        <RotateCcw className="size-4" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="flex items-center justify-center rounded-full bg-red-500/20 p-2 text-red-300 transition hover:bg-red-500/30 hover:text-red-100"
        title="删除"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

export interface AiToolAction {
  id: string;
  label: string;
  icon: ReactNode;
  action: string;
}

export const aiTools: AiToolAction[] = [
  {
    id: "expand",
    label: "AI扩图",
    icon: <Maximize2 className="size-3.5" />,
    action: "expand",
  },
  {
    id: "cutout",
    label: "一键抠图",
    icon: <Scissors className="size-3.5" />,
    action: "cutout",
  },
  {
    id: "edit",
    label: "局部修改",
    icon: <Pencil className="size-3.5" />,
    action: "edit",
  },
  {
    id: "upscale",
    label: "AI超清",
    icon: <ZoomIn className="size-3.5" />,
    action: "upscale",
  },
  {
    id: "enhance",
    label: "图片清晰",
    icon: <CircleDot className="size-3.5" />,
    action: "enhance",
  },
  {
    id: "remix",
    label: "变体",
    icon: <Sparkles className="size-3.5" />,
    action: "remix",
  },
];
