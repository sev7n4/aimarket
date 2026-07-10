import type { CanvasItem } from "@/lib/canvas-tools";
import { assetUrl } from "@/lib/api-client";
import { CanvasNodeType, type CanvasNodeData, type CanvasConnection } from "./types";

/**
 * Convert a CanvasItem (aimarket legacy) to a CanvasNodeData (infinite-canvas format).
 */
export function canvasItemToNodeData(item: CanvasItem): CanvasNodeData {
  if (item.infiniteNodeType === "text") {
    return {
      id: item.id,
      type: CanvasNodeType.Text,
      title: item.label || "Note",
      position: { x: item.x, y: item.y },
      width: item.width,
      height: item.height,
      metadata: {
        content: item.infiniteNodeMeta?.content ?? "",
        status: "idle",
        fontSize: 14,
      },
    };
  }
  if (item.infiniteNodeType === "config") {
    return {
      id: item.id,
      type: CanvasNodeType.Config,
      title: item.label || "生成配置",
      position: { x: item.x, y: item.y },
      width: item.width,
      height: item.height,
      metadata: {
        content: "",
        status: "idle",
        generationMode: item.infiniteNodeMeta?.generationMode ?? "image",
        prompt: item.infiniteNodeMeta?.prompt ?? "",
      },
    };
  }
  if (item.infiniteNodeType === "workflow") {
    const meta = item.infiniteNodeMeta;
    const mode = meta?.generationMode ?? "image";
    const type =
      mode === "video" ? CanvasNodeType.Video
      : mode === "audio" ? CanvasNodeType.Audio
      : CanvasNodeType.Image;
    return {
      id: item.id,
      type,
      title: item.label || "工作流节点",
      position: { x: item.x, y: item.y },
      width: item.width,
      height: item.height,
      metadata: {
        content: item.url ? assetUrl(item.url) : meta?.content ?? "",
        status: meta?.workflowJobId ? "loading" : meta?.status ?? "idle",
        generationMode: mode,
        prompt: meta?.prompt,
        workflowToolType: meta?.workflowToolType,
        workflowNodeKey: meta?.workflowNodeKey,
        workflowJobId: meta?.workflowJobId,
        connectedImageUrls: meta?.connectedImageUrls,
        connectedVideoUrls: meta?.connectedVideoUrls,
        connectedAudioUrls: meta?.connectedAudioUrls,
      },
    };
  }
  return {
    id: item.id,
    type: item.isVideo ? CanvasNodeType.Video : CanvasNodeType.Image,
    title: item.label || item.batchTitle || "",
    position: { x: item.x, y: item.y },
    width: item.width,
    height: item.height,
    metadata: {
      content: item.url ? assetUrl(item.url) : "",
      status:
        item.infiniteNodeMeta?.status ??
        (item.url?.trim() ? "idle" : item.infiniteNodeMeta?.pendingJobId ? "loading" : "idle"),
      naturalWidth: item.width,
      naturalHeight: item.height,
      batchRootId: item.batchId,
      primaryImageId: item.assetId,
      prompt: item.infiniteNodeMeta?.prompt,
      generationMode: item.infiniteNodeMeta?.generationMode,
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
  if (node.type === CanvasNodeType.Text) {
    return {
      id: node.id,
      url: "",
      x: node.position.x,
      y: node.position.y,
      width: node.width,
      height: node.height,
      isVideo: false,
      label: node.title,
      infiniteNodeType: "text",
      infiniteNodeMeta: {
        content: node.metadata?.content ?? "",
      },
    };
  }
  if (node.type === CanvasNodeType.Config) {
    return {
      id: node.id,
      url: "",
      x: node.position.x,
      y: node.position.y,
      width: node.width,
      height: node.height,
      isVideo: false,
      label: node.title,
      infiniteNodeType: "config",
      infiniteNodeMeta: {
        generationMode: node.metadata?.generationMode ?? "image",
        prompt: node.metadata?.prompt ?? "",
      },
    };
  }
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
    infiniteNodeMeta:
      node.metadata?.status || node.metadata?.prompt || node.metadata?.generationMode
        ? {
            status: node.metadata?.status,
            prompt: node.metadata?.prompt,
            generationMode: node.metadata?.generationMode,
          }
        : undefined,
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

function connectionKey(conn: Pick<CanvasConnection, "fromNodeId" | "toNodeId">): string {
  return `${conn.fromNodeId}->${conn.toNodeId}`;
}

/** 合并血缘、手动与 Drama 连线，按 from→to 去重 */
export function mergeCanvasConnections(
  items: CanvasItem[],
  manualConnections: CanvasConnection[] = [],
  dramaConnections: CanvasConnection[] = [],
): CanvasConnection[] {
  const seen = new Set<string>();
  const merged: CanvasConnection[] = [];
  for (const conn of [
    ...buildConnectionsFromItems(items),
    ...manualConnections,
    ...dramaConnections,
  ]) {
    const key = connectionKey(conn);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(conn);
  }
  return merged;
}

export function isLineageConnection(
  conn: CanvasConnection,
  items: CanvasItem[],
): boolean {
  return items.some(
    (item) => item.id === conn.toNodeId && item.sourceItemId === conn.fromNodeId,
  );
}
