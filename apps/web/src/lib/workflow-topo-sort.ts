import type { CanvasConnection, CanvasNodeData } from "@/components/infinite-canvas/types";

export type WorkflowTopoSortResult = {
  order: string[];
  cycle: boolean;
};

/**
 * Kahn 拓扑排序：供 Run All 按依赖顺序执行工作流节点。
 * 边方向 from → to 表示 to 依赖 from 先完成。
 */
export function topoSortWorkflowNodes(
  nodes: CanvasNodeData[],
  edges: CanvasConnection[],
): WorkflowTopoSortResult {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) continue;
    adjacency.get(edge.fromNodeId)!.push(edge.toNodeId);
    inDegree.set(edge.toNodeId, (inDegree.get(edge.toNodeId) ?? 0) + 1);
  }

  for (const neighbors of adjacency.values()) {
    neighbors.sort();
  }

  const queue = [...nodeIds].filter((id) => (inDegree.get(id) ?? 0) === 0).sort();
  const order: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    for (const next of adjacency.get(current) ?? []) {
      const nextDegree = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, nextDegree);
      if (nextDegree === 0) {
        queue.push(next);
        queue.sort();
      }
    }
  }

  return { order, cycle: order.length !== nodeIds.size };
}
