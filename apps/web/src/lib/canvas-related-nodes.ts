/**
 * P4.4 — Related-node 计算
 *
 * 给定一个焦点节点 id + 当前画布所有边，返回所有相关的节点 id 集合
 * （沿 trigger/reference 边双向 BFS）。
 *
 * 抽成纯函数是为了便于单测；CanvasFlow 组件内部直接复用。
 */

export interface RelatedEdge {
  source: string;
  target: string;
}

/**
 * 计算 focusId 的所有相关节点（双向 BFS）。
 * 当 edges 为空或 focusId 不在任何边里时，返回只含 focusId 的集合。
 */
export function computeRelatedNodeIds(
  focusId: string,
  edges: ReadonlyArray<RelatedEdge>,
): Set<string> {
  const related = new Set<string>([focusId]);
  const queue: string[] = [focusId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const e of edges) {
      if (e.source === current && !related.has(e.target)) {
        related.add(e.target);
        queue.push(e.target);
      } else if (e.target === current && !related.has(e.source)) {
        related.add(e.source);
        queue.push(e.source);
      }
    }
  }
  return related;
}
