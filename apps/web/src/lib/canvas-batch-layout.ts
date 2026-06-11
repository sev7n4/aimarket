import type { CanvasItem } from "@/lib/canvas-tools";

/** 移动端 2–4 张/段批次：两列网格（对标极梦画布多图/多段视频排版） */
export function shouldUseMobileTwoColumnGrid(
  items: CanvasItem[],
  isMobile: boolean,
): boolean {
  if (!isMobile || items.length < 2 || items.length > 4) return false;
  const allImage = items.every((item) => !item.isVideo);
  const allVideo = items.every((item) => item.isVideo);
  return allImage || allVideo;
}

export function batchOutputCountLabel(items: CanvasItem[]): string {
  const unit = items.some((i) => i.isVideo) ? "段" : "张";
  return `${items.length} ${unit}`;
}

export function batchItemAspectRatio(item: CanvasItem): number {
  if (item.width > 0 && item.height > 0) return item.width / item.height;
  return item.isVideo ? 16 / 9 : 1;
}
