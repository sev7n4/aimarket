import type { CreationMode } from "@aimarket/ui";
import type { CreationLane } from "@/lib/creation-dock-prefs";
import type { DramaStudioViewPhase } from "@/lib/drama-studio-view";

/**
 * Studio 画布模式（scroll ↔ infinite）的单一决策点。
 *
 * 统一后的模型（三车道一致）：
 * - 默认进入 ScrollCanvas（左对话/时间线 + 右产物滚动浏览）。
 * - 用户手动切到「节点视图」(viewPhase = "workflow") 才进入 InfiniteCanvas。
 * - `canvasFlowEnabled`（isCanvasFlowMode()）作为 E2E / 深链的逃生开关：
 *   关闭时任何车道都锁定 ScrollCanvas。
 * - 短剧规划进行中强制回退 Scroll，展示规划工作台。
 *
 * 说明：`creationLane` / `studioMode` 不再参与「是否 Infinite」的判断，
 * 仅 `resolveDramaPhaseSplitEnabled` 用于决定 Infinite 下是否叠加短剧节点面板。
 */
export interface CanvasViewInput {
  /** 节点式画布全局开关（isCanvasFlowMode()，默认 true；关闭则锁定 Scroll） */
  canvasFlowEnabled: boolean;
  /** 用户显式选择的画布视图（scroll 对话 / workflow 节点） */
  viewPhase: DramaStudioViewPhase;
  /** 短剧规划进行中：强制回退到 Scroll 展示规划工作台 */
  isDramaPlanActive: boolean;
}

/**
 * Infinite 画布下是否叠加「短剧节点编排面板」。
 *
 * 仅 Agent 车道 + 制片模式 + canvasFlow 时启用；其余车道进入 Infinite 走通用
 * 自由节点画布（不含短剧 Studio 面板）。
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
 * 「节点视图 ↔ 滚动视图」切换开关是否对当前会话可用（三车道一致）。
 */
export function resolveCanvasViewToggleEnabled(input: {
  canvasFlowEnabled: boolean;
}): boolean {
  return input.canvasFlowEnabled;
}

/**
 * 画布是否使用 InfiniteCanvas（true）还是 ScrollCanvas（false）。
 *
 * 统一规则（不区分车道 / 模式）：
 * - 短剧规划中 → 始终 Scroll。
 * - canvasFlow 关闭 → 始终 Scroll。
 * - 其余情况跟随用户显式选择：仅当切到 workflow(节点视图) 才 Infinite，默认 Scroll。
 */
export function resolveUseInfiniteCanvas(input: CanvasViewInput): boolean {
  if (input.isDramaPlanActive) return false;
  return input.canvasFlowEnabled && input.viewPhase === "workflow";
}

/**
 * Infinite 引擎下且短剧 phase split 开启、用户处于 workflow（节点）视图。
 *
 * 控制侧栏 Drama/Assistant 面板与 legacy orchestration dock；
 * **不等于** `resolveUseInfiniteCanvas`（后者只决定是否渲染 Infinite 引擎）。
 */
export function resolveIsDramaWorkflowInfiniteView(input: {
  useInfiniteCanvas: boolean;
  dramaPhaseSplitEnabled: boolean;
  viewPhase: DramaStudioViewPhase;
}): boolean {
  return (
    input.useInfiniteCanvas &&
    input.dramaPhaseSplitEnabled &&
    input.viewPhase === "workflow"
  );
}
