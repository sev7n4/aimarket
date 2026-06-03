import type { ExpandExtend } from "@/lib/expand-extend";

export type ExpandAspectPreset = "free" | "1:1" | "4:3" | "16:9" | "9:16";

export const EXPAND_ASPECT_PRESETS: Array<{
  id: ExpandAspectPreset;
  label: string;
}> = [
  { id: "free", label: "自由" },
  { id: "1:1", label: "1:1" },
  { id: "4:3", label: "4:3" },
  { id: "16:9", label: "16:9" },
  { id: "9:16", label: "9:16" },
];

/** 相对原图四边的扩边像素（画布坐标） */
export interface ExpandFramePadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function defaultExpandPadding(
  imgW: number,
  imgH: number,
): ExpandFramePadding {
  const pad = Math.max(24, Math.round(Math.min(imgW, imgH) * 0.12));
  return { top: pad, right: pad, bottom: pad, left: pad };
}

function parseAspect(preset: ExpandAspectPreset): number | null {
  switch (preset) {
    case "1:1":
      return 1;
    case "4:3":
      return 4 / 3;
    case "16:9":
      return 16 / 9;
    case "9:16":
      return 9 / 16;
    default:
      return null;
  }
}

/** 锁定外框宽高比时，在保持原图居中的前提下调整四边 padding */
export function applyAspectToPadding(
  padding: ExpandFramePadding,
  imgW: number,
  imgH: number,
  preset: ExpandAspectPreset,
): ExpandFramePadding {
  const ratio = parseAspect(preset);
  if (ratio == null) return padding;

  const outerW = imgW + padding.left + padding.right;
  const outerH = imgH + padding.top + padding.bottom;
  let targetW = outerW;
  let targetH = outerH;

  if (outerW / outerH > ratio) {
    targetH = outerW / ratio;
  } else {
    targetW = outerH * ratio;
  }

  const extraW = Math.max(0, targetW - outerW);
  const extraH = Math.max(0, targetH - outerH);

  return {
    top: padding.top + extraH / 2,
    bottom: padding.bottom + extraH / 2,
    left: padding.left + extraW / 2,
    right: padding.right + extraW / 2,
  };
}

const SCALE_MIN = 1;
const SCALE_MAX = 2;

function clampScale(n: number): number {
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, n));
}

/** 将 UI 扩图框转为 API extend（各边 scale） */
export function paddingToExtend(
  padding: ExpandFramePadding,
  imgW: number,
  imgH: number,
): ExpandExtend {
  return {
    top: clampScale(1 + padding.top / imgH),
    right: clampScale(1 + padding.right / imgW),
    bottom: clampScale(1 + padding.bottom / imgH),
    left: clampScale(1 + padding.left / imgW),
  };
}

export type ExpandHandle =
  | "top-left"
  | "top"
  | "top-right"
  | "right"
  | "bottom-right"
  | "bottom"
  | "bottom-left"
  | "left";

export function resizePaddingFromHandle(
  padding: ExpandFramePadding,
  imgW: number,
  imgH: number,
  handle: ExpandHandle,
  dx: number,
  dy: number,
  aspectPreset: ExpandAspectPreset,
): ExpandFramePadding {
  const minPad = 8;
  let next = { ...padding };

  switch (handle) {
    case "top-left":
      next.top = Math.max(minPad, padding.top - dy);
      next.left = Math.max(minPad, padding.left - dx);
      break;
    case "top":
      next.top = Math.max(minPad, padding.top - dy);
      break;
    case "top-right":
      next.top = Math.max(minPad, padding.top - dy);
      next.right = Math.max(minPad, padding.right + dx);
      break;
    case "right":
      next.right = Math.max(minPad, padding.right + dx);
      break;
    case "bottom-right":
      next.bottom = Math.max(minPad, padding.bottom + dy);
      next.right = Math.max(minPad, padding.right + dx);
      break;
    case "bottom":
      next.bottom = Math.max(minPad, padding.bottom + dy);
      break;
    case "bottom-left":
      next.bottom = Math.max(minPad, padding.bottom + dy);
      next.left = Math.max(minPad, padding.left - dx);
      break;
    case "left":
      next.left = Math.max(minPad, padding.left - dx);
      break;
  }

  return applyAspectToPadding(next, imgW, imgH, aspectPreset);
}
