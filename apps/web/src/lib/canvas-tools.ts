import type { LucideIcon } from "lucide-react";
import {
  Download,
  Grid3x3,
  Hand,
  ImagePlus,
  Maximize2,
  MousePointer2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

export type CanvasToolId =
  | "select"
  | "pan"
  | "zoom-in"
  | "zoom-out"
  | "fit"
  | "upload"
  | "download"
  | "grid";

export interface CanvasToolDef {
  id: CanvasToolId;
  label: string;
  icon: LucideIcon;
}

/** 画布区操作工具（对标椒图左侧竖栏，与 AI 修图工具区分） */
export const canvasTools: CanvasToolDef[] = [
  { id: "select", label: "选择", icon: MousePointer2 },
  { id: "pan", label: "移动画布", icon: Hand },
  { id: "zoom-in", label: "放大", icon: ZoomIn },
  { id: "zoom-out", label: "缩小", icon: ZoomOut },
  { id: "fit", label: "适应画布", icon: Maximize2 },
  { id: "upload", label: "上传图片", icon: ImagePlus },
  { id: "download", label: "下载", icon: Download },
  { id: "grid", label: "网格", icon: Grid3x3 },
];

export interface CanvasItem {
  id: string;
  url: string;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isVideo: boolean;
}

export function buildCanvasItemsFromMessages(
  messages: { id: string; outputs: { url: string; sort_order: number }[] }[],
): CanvasItem[] {
  const items: CanvasItem[] = [];
  const cols = 3;
  const gap = 24;
  const cellW = 200;
  const cellH = 200;
  let idx = 0;

  for (const msg of messages) {
    if (!msg.outputs?.length) continue;
    msg.outputs.forEach((out, i) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const isVideo =
        out.url.includes(".mp4") || out.url.includes("video");
      items.push({
        id: `${msg.id}-${i}`,
        url: out.url,
        label: msg.outputs.length === 4 ? ["主图", "卖点", "场景", "详情"][i] : undefined,
        x: 80 + col * (cellW + gap),
        y: 80 + row * (cellH + gap),
        width: cellW,
        height: isVideo ? Math.round(cellW * 0.56) : cellW,
        isVideo,
      });
      idx += 1;
    });
  }
  return items;
}
