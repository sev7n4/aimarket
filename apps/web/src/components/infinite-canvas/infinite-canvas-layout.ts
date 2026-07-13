/** 无限画布右下角缩放条距底边（px） */
export const INFINITE_CANVAS_CONTROL_BOTTOM = 12;

/** 缩放控件高度（与 CanvasZoomControls `h-10` 一致） */
export const INFINITE_ZOOM_BAR_HEIGHT = 40;

/** 小地图与缩放条之间的间距（px） */
export const INFINITE_MINIMAP_GAP = 12;

/** 小地图底边 = 缩放条底边 + 缩放条高度 + 间距 */
export const INFINITE_MINIMAP_BOTTOM_OFFSET =
  INFINITE_CANVAS_CONTROL_BOTTOM + INFINITE_ZOOM_BAR_HEIGHT + INFINITE_MINIMAP_GAP;

export function infiniteZoomControlsBottom(insetPx = 0): number {
  return INFINITE_CANVAS_CONTROL_BOTTOM + insetPx;
}

export function infiniteMiniMapBottom(insetPx = 0): number {
  return INFINITE_MINIMAP_BOTTOM_OFFSET + insetPx;
}

/** 左下角指南 / 开关条距底边（与缩放条对齐） */
export function infiniteLeftChromeBottom(insetPx = 0): number {
  return INFINITE_CANVAS_CONTROL_BOTTOM + insetPx;
}
