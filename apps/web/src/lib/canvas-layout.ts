/**
 * 画布自动布局工具
 * 基于 dagre 实现节点一鍵整理（横向 LR / 纵向 TB）
 */

import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";

export type LayoutDirection = "LR" | "TB";

const NODE_DEFAULT_WIDTH = 200;
const NODE_DEFAULT_HEIGHT = 100;

interface LayoutOptions {
  direction?: LayoutDirection;
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
}

/**
 * 对 React Flow 节点和边运行 dagre 自动布局，返回新的节点位置。
 * - 不修改原 nodes/edges
 * - 适配 React Flow 的节点尺寸（使用 measured 字段或默认 200x100）
 */
export function autoLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {},
): Node[] {
  if (nodes.length === 0) return nodes;

  const {
    direction = "LR",
    nodeWidth = NODE_DEFAULT_WIDTH,
    nodeHeight = NODE_DEFAULT_HEIGHT,
    rankSep = 80,
    nodeSep = 40,
  } = options;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, ranksep: rankSep, nodesep: nodeSep });

  for (const node of nodes) {
    const w = node.measured?.width ?? node.width ?? nodeWidth;
    const h = node.measured?.height ?? node.height ?? nodeHeight;
    g.setNode(node.id, { width: w, height: h });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const layoutNode = g.node(node.id);
    if (!layoutNode) return node;
    return {
      ...node,
      position: {
        x: layoutNode.x - nodeWidth / 2,
        y: layoutNode.y - nodeHeight / 2,
      },
    };
  });
}
