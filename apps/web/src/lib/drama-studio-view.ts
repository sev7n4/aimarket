/** 制片 Studio 画布阶段：Agent 对话车道 vs 无限画布节点编排 */
export type DramaStudioViewPhase = "agent" | "workflow";

export function toggleDramaStudioViewPhase(
  phase: DramaStudioViewPhase,
): DramaStudioViewPhase {
  return phase === "agent" ? "workflow" : "agent";
}
