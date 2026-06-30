import type { CanvasItem } from "@/lib/canvas-tools";
import { assetUrl } from "@/lib/api-client";
import { CanvasNodeType, type CanvasNodeData, type CanvasConnection } from "./types";

/**
 * Convert a CanvasItem (aimarket legacy) to a CanvasNodeData (infinite-canvas format).
 */
export function canvasItemToNodeData(item: CanvasItem): CanvasNodeData {
  return {
    id: item.id,
    type: item.isVideo ? CanvasNodeType.Video : CanvasNodeType.Image,
    title: item.label || item.batchTitle || "",
    position: { x: item.x, y: item.y },
    width: item.width,
    height: item.height,
    metadata: {
      content: assetUrl(item.url),
      status: "idle",
      naturalWidth: item.width,
      naturalHeight: item.height,
      batchRootId: item.batchId,
      primaryImageId: item.assetId,
    },
  };
}

/**
 * Convert an array of CanvasItems to CanvasNodeData[].
 */
export function canvasItemsToNodeData(items: CanvasItem[]): CanvasNodeData[] {
  return items.map(canvasItemToNodeData);
}

/**
 * Convert a CanvasNodeData back to a CanvasItem (aimarket legacy format).
 */
export function nodeDataToCanvasItem(node: CanvasNodeData): CanvasItem {
  return {
    id: node.id,
    url: node.metadata?.content || "",
    x: node.position.x,
    y: node.position.y,
    width: node.width,
    height: node.height,
    isVideo: node.type === CanvasNodeType.Video,
    label: node.title,
    batchId: node.metadata?.batchRootId,
    assetId: node.metadata?.primaryImageId,
  };
}

/**
 * Convert an array of CanvasNodeData back to CanvasItem[].
 */
export function nodeDataToCanvasItems(nodes: CanvasNodeData[]): CanvasItem[] {
  return nodes.map(nodeDataToCanvasItem);
}

/**
 * Apply node position/dimension updates to existing CanvasItems without
 * losing fields that are not represented in CanvasNodeData (thumbUrl,
 * source, role, outputId, batchIndex, batchTitle, batchSubtitle,
 * parentBatchId, locked, generationParams, etc.).
 */
export function applyNodePositionsToItems(
  items: CanvasItem[],
  nodes: CanvasNodeData[],
): CanvasItem[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  return items.map(item => {
    const node = nodeMap.get(item.id);
    if (!node) return item;
    return {
      ...item,
      x: node.position.x,
      y: node.position.y,
      width: node.width,
      height: node.height,
    };
  });
}

/**
 * Build CanvasConnection[] from CanvasItem[] using batch relationships.
 * Items in the same batch are connected from the batch root to children.
 * Items with sourceItemId are connected from their source.
 */
export function buildConnectionsFromItems(items: CanvasItem[]): CanvasConnection[] {
  const connections: CanvasConnection[] = [];
  let connIndex = 0;

  for (const item of items) {
    // Connect source → derived item
    if (item.sourceItemId) {
      const sourceExists = items.some((i) => i.id === item.sourceItemId);
      if (sourceExists) {
        connections.push({
          id: `conn-${connIndex++}`,
          fromNodeId: item.sourceItemId,
          toNodeId: item.id,
        });
      }
    }
  }

  return connections;
}
