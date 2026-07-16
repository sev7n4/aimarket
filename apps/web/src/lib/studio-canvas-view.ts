/**
 * Studio 画布引擎决策（Phase D：仅 ScrollCanvas）。
 */
export type CanvasEngine = "scroll";

/** 画布引擎；终态恒为 scroll */
export function resolveCanvasEngine(): CanvasEngine {
  return "scroll";
}

/** 「节点视图 ↔ 滚动视图」切换（已下线，恒 false） */
export function resolveCanvasViewToggleEnabled(): boolean {
  return false;
}
