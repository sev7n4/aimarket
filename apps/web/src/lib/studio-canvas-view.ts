import type { CreationMode } from "@aimarket/ui";
import type { CreationLane } from "@/lib/creation-dock-prefs";
import type { DramaStudioViewPhase } from "@/lib/drama-studio-view";

/**
 * Studio 画布模式（scroll ↔ infinite）的单一决策点。
 *
 * 目的：把原先散落在 `studio-canvas-with-orchestration.tsx` 里、由
 * `creationLane` / `studioMode` / `canvasFlowEnabled` / `viewPhase` /
 * `isDramaPlanActive` 多个信号交织推导的 `useInfiniteCanvas` 收敛到一处纯函数，
 * 便于单测与后续统一 lane 轴的精简。
 *
 * 本文件为「零行为变更」版本：完全复刻迁移前的判断，仅集中表达。
 */
export interface CanvasViewInput {
  /** 当前创作车道（agent / image / video） */
  creationLane: CreationLane;
  /** 会话级模式（chat / image / ecommerce / production） */
  studioMode: CreationMode;
  /** 节点式画布全局开关（isCanvasFlowMode()，默认 true） */
  canvasFlowEnabled: boolean;
  /** 用户显式选择的画布阶段（agent 对话 / workflow 节点） */
  viewPhase: DramaStudioViewPhase;
  /** 短剧规划进行中：强制回退到 Scroll 展示规划工作台 */
  isDramaPlanActive: boolean;
}

/**
 * Agent 车道 + 制片 + canvasFlow：Scroll(Agent) ↔ Infinite(节点) 阶段分离是否启用。
 */
export function resolveDramaPhaseSplitEnabled(input: {
  creationLane: CreationLane;
  studioMode: CreationMode;
  canvasFlowEnabled: boolean;
}): boolean {
  return (
    input.creationLane === "agent" &&
    input.studioMode === "production" &&
    input.canvasFlowEnabled
  );
}

/**
 * 画布是否使用 InfiniteCanvas（true）还是 ScrollCanvas（false）。
 *
 * 现状（迁移前逻辑，逐条复刻）：
 * - 短剧规划中 → 始终 Scroll。
 * - 制片模式 → 仅当阶段分离启用且用户切到 workflow 才 Infinite。
 * - 其余模式（chat/image/ecommerce）→ 直接跟随 canvasFlowEnabled（默认 Infinite）。
 */
export function resolveUseInfiniteCanvas(input: CanvasViewInput): boolean {
  if (input.isDramaPlanActive) return false;
  if (input.studioMode === "production") {
    return (
      resolveDramaPhaseSplitEnabled(input) && input.viewPhase === "workflow"
    );
  }
  return input.canvasFlowEnabled;
}
