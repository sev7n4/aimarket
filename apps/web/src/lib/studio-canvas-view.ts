/**
 * Studio 画布模式（scroll ↔ infinite）的单一决策点。
 *
 * Phase C：Drama/Production 已下线，固定 ScrollCanvas（viewPhase 恒为 agent）。
 * Phase D 将在此收敛 `resolveUseInfiniteCanvas` 为恒 false 并删除 Infinite 挂载。
 */
export interface CanvasViewInput {
  /** 节点式画布全局开关（isCanvasFlowMode()；Phase C 暂不参与决策） */
  canvasFlowEnabled: boolean;
}

/** 「节点视图 ↔ 滚动视图」切换（Phase C 已下线，恒 false） */
export function resolveCanvasViewToggleEnabled(_input: {
  canvasFlowEnabled: boolean;
}): boolean {
  return false;
}

/** 画布是否使用 InfiniteCanvas。Phase C：恒 false（仅 ScrollCanvas）。 */
export function resolveUseInfiniteCanvas(_input?: CanvasViewInput): boolean {
  return false;
}
