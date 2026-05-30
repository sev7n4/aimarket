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
} from "lucide-react";

export interface ImageActionBarProps {
  item: CanvasItem;
  onPreview: () => void;
  onRefine: () => void;
  onDelete: () => void;
  selected?: boolean;
}

export function ImageActionBar({
  onPreview,
  onRefine,
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
    id: "rerun",
    label: "重跑",
    icon: <RotateCcw className="size-3.5" />,
    action: "rerun",
  },
  {
    id: "remix",
    label: "变体",
    icon: <Sparkles className="size-3.5" />,
    action: "remix",
  },
  {
    id: "expand",
    label: "扩图",
    icon: <Expand className="size-3.5" />,
    action: "expand",
  },
  {
    id: "crop",
    label: "裁剪",
    icon: <Crop className="size-3.5" />,
    action: "crop",
  },
  {
    id: "erase",
    label: "擦除",
    icon: <Eraser className="size-3.5" />,
    action: "erase",
  },
  {
    id: "edit",
    label: "编辑",
    icon: <Wand2 className="size-3.5" />,
    action: "edit",
  },
];
