import { assetUrl } from "@/lib/api-client";
import type { CanvasItem } from "@/lib/canvas-tools";
import {
  CanvasNodeType,
  type CanvasNodeData,
} from "@/components/infinite-canvas/types";

/** InfiniteCanvas 节点右键触发的工具请求 */
export type InfiniteNodeToolRequest = {
  toolId: string;
  node: CanvasNodeData;
  prompt?: string;
  toolContext?: Record<string, unknown>;
};

export function resolveNodeImageUrl(node: CanvasNodeData): string | null {
  const m = node.metadata;
  if (!m) return null;
  if (m.content) return m.content;
  if (m.keyframeOutputId) return assetUrl(`/outputs/${m.keyframeOutputId}`);
  return null;
}

export function resolveNodeToolPrompt(
  node: CanvasNodeData,
  fallback?: string,
): string {
  const m = node.metadata;
  return (
    m?.visualPrompt?.trim() ||
    m?.promptAnchor?.trim() ||
    node.title?.trim() ||
    fallback?.trim() ||
    "按节点内容重新生成"
  );
}

export function resolveNodeToolReferences(
  node: CanvasNodeData,
  item: CanvasItem | null,
): { referenceOutputIds?: string[]; assetIds?: string[] } {
  if (item?.outputId) {
    return { referenceOutputIds: [item.outputId] };
  }
  if (item?.assetId) {
    return { assetIds: [item.assetId] };
  }
  const keyframeId = node.metadata?.keyframeOutputId;
  if (keyframeId) {
    return { referenceOutputIds: [keyframeId] };
  }
  return {};
}

export function isDramaShotNode(node: CanvasNodeData): boolean {
  return node.type === CanvasNodeType.Shot && node.id.startsWith("drama-shot-");
}

export function dramaShotIdFromNodeId(nodeId: string): string | null {
  if (!nodeId.startsWith("drama-shot-")) return null;
  return nodeId.slice("drama-shot-".length);
}
