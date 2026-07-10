import type { CanvasNodeData, ViewportTransform } from "@/components/infinite-canvas/types";

export type FitViewportRect = {
  width: number;
  height: number;
};

/**
 * 计算使全部节点落入视口的 viewport（居中 + 等比缩放）。
 * 无节点时返回居中 1x。
 */
export function computeFitViewport(
  nodes: CanvasNodeData[],
  container: FitViewportRect,
  padding = 64,
): ViewportTransform {
  const w = Math.max(container.width, 1);
  const h = Math.max(container.height, 1);

  if (nodes.length === 0) {
    return { x: w / 2, y: h / 2, k: 1 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + node.width);
    maxY = Math.max(maxY, node.position.y + node.height);
  }

  const contentW = Math.max(maxX - minX, 1);
  const contentH = Math.max(maxY - minY, 1);
  const availW = Math.max(w - padding * 2, 1);
  const availH = Math.max(h - padding * 2, 1);
  const k = Math.min(Math.max(Math.min(availW / contentW, availH / contentH), 0.05), 5);

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return {
    x: w / 2 - centerX * k,
    y: h / 2 - centerY * k,
    k,
  };
}
