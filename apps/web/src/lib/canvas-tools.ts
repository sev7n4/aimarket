import type { LucideIcon } from "lucide-react";
import { randomUUID } from "@/lib/uuid";
import {
  Download,
  Grid3x3,
  Hand,
  ImagePlus,
  Maximize2,
  MousePointer2,
  Trash2,
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
  | "delete"
  | "grid";

export interface CanvasToolDef {
  id: CanvasToolId;
  label: string;
  icon: LucideIcon;
}

/** 画布区操作工具（对标椒图左侧竖栏，与 AI 修图工具区分） */
export const canvasTools: CanvasToolDef[] = [
  { id: "select", label: "选择 / 拖拽", icon: MousePointer2 },
  { id: "pan", label: "移动画布", icon: Hand },
  { id: "zoom-in", label: "放大", icon: ZoomIn },
  { id: "zoom-out", label: "缩小", icon: ZoomOut },
  { id: "fit", label: "适应画布", icon: Maximize2 },
  { id: "upload", label: "上传图片", icon: ImagePlus },
  { id: "download", label: "下载", icon: Download },
  { id: "delete", label: "删除选中", icon: Trash2 },
  { id: "grid", label: "网格", icon: Grid3x3 },
];

export type CanvasItemSource = "upload" | "generation";

/** 画布素材角色：参考套图 / 商品素材 / 生成成品 */
export type CanvasItemRole = "reference" | "product" | "output";

export interface CanvasItem {
  id: string;
  url: string;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isVideo: boolean;
  source?: CanvasItemSource;
  role?: CanvasItemRole;
  /** 已入库 assets.id，供套图生成 productAssetId / referenceAssetId */
  assetId?: string;
  /** 关联 message_outputs.id，供 AI 工具引用 */
  outputId?: string;
}

export interface CanvasMaskSelection {
  id: string;
  itemId: string;
  toolId: string;
  /** brush = 手指/鼠标自由圈选；box = 矩形框选 */
  mode: "brush" | "box";
  /** 黑底白色 mask PNG data URL，坐标系与原画布 item 尺寸一致 */
  maskDataUrl: string;
  /** 被圈选区域在源图上的像素 bbox */
  bbox: { x: number; y: number; width: number; height: number };
  /** 归一化 bbox，便于供应商/后端按原图尺寸换算 */
  normalizedBbox: { x: number; y: number; width: number; height: number };
}

const CELL_W = 200;
const GAP = 24;

export function nextCanvasPosition(
  items: CanvasItem[],
  width = CELL_W,
  height = CELL_W,
): Pick<CanvasItem, "x" | "y" | "width" | "height"> {
  const cols = 3;
  const idx = items.length;
  const col = idx % cols;
  const row = Math.floor(idx / cols);
  return {
    x: 80 + col * (width + GAP),
    y: 80 + row * (height + GAP),
    width,
    height,
  };
}

export function buildCanvasItemsFromMessages(
  messages: {
    id: string;
    outputs: { id?: string; url: string; sort_order: number; label?: string }[];
  }[],
): CanvasItem[] {
  const items: CanvasItem[] = [];
  let idx = 0;

  for (const msg of messages) {
    if (!msg.outputs?.length) continue;
    msg.outputs.forEach((out, i) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const isVideo =
        out.url.includes(".mp4") || out.url.includes("video");
      const height = isVideo ? Math.round(CELL_W * 0.56) : CELL_W;
      const fallbackLabel =
        msg.outputs.length === 4
          ? (["主图", "卖点", "场景", "详情"][i] as string | undefined)
          : undefined;
      items.push({
        id: out.id ?? `${msg.id}-${i}`,
        outputId: out.id,
        url: out.url,
        label: out.label ?? fallbackLabel,
        x: 80 + col * (CELL_W + GAP),
        y: 80 + row * (CELL_W + GAP),
        width: CELL_W,
        height,
        isVideo,
        source: "generation",
        role: "output",
      });
      idx += 1;
    });
  }
  return items;
}

/** 保留已保存坐标，仅为新生成图追加布局 */
export function mergeCanvasItems(
  saved: CanvasItem[],
  incoming: CanvasItem[],
): CanvasItem[] {
  const urlSeen = new Set(saved.map((i) => i.url));
  const idSeen = new Set(saved.map((i) => i.id));
  const merged = [...saved];

  for (const item of incoming) {
    if (urlSeen.has(item.url)) continue;
    let id = item.id;
    if (idSeen.has(id)) {
      id = `${item.id}-${randomUUID().slice(0, 8)}`;
    }
    const slot = nextCanvasPosition(merged, item.width, item.height);
    merged.push({
      ...item,
      id,
      ...slot,
      source: item.source ?? "generation",
    });
    urlSeen.add(item.url);
    idSeen.add(id);
  }
  return merged;
}

export function createUploadCanvasItem(
  url: string,
  items: CanvasItem[],
  options?: { assetId?: string; role?: CanvasItemRole; label?: string },
): CanvasItem {
  const pos = nextCanvasPosition(items);
  const role = options?.role ?? "product";
  return {
    id: `upload-${randomUUID()}`,
    url,
    assetId: options?.assetId,
    role,
    ...pos,
    isVideo: false,
    source: "upload",
    label: options?.label ?? (role === "product" ? "商品素材" : "上传"),
  };
}

export function createReferenceCanvasItem(
  url: string,
  items: CanvasItem[],
  assetId: string,
  index: number,
): CanvasItem {
  const item = createUploadCanvasItem(url, items, {
    assetId,
    role: "reference",
    label: index > 0 ? `套图参考 ${index + 1}` : "套图参考",
  });
  return item;
}
