import type { CanvasItem } from "@/lib/canvas-tools";
import { randomUUID } from "@/lib/uuid";
import {
  canvasItemToNodeData,
  nodeDataToCanvasItem,
} from "./migration";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from "./types";
import type { CanvasAgentSnapshot } from "./utils";

const DRAMA_TYPES = new Set([
  CanvasNodeType.Script,
  CanvasNodeType.Shot,
  CanvasNodeType.Character,
  CanvasNodeType.Scene,
]);

function isPersistedCanvasNode(node: CanvasNodeData): boolean {
  return !DRAMA_TYPES.has(node.type);
}

function manualNodeToCanvasItem(node: CanvasNodeData): CanvasItem {
  const base = nodeDataToCanvasItem(node);
  return {
    ...base,
    url: base.url || "",
    infiniteNodeType:
      node.type === CanvasNodeType.Config ? "config" : "text",
    infiniteNodeMeta: {
      content: node.metadata?.content ?? "",
      generationMode: node.metadata?.generationMode ?? "image",
      prompt: node.metadata?.prompt ?? "",
    },
  };
}

function canvasItemToPersistedNode(item: CanvasItem): CanvasNodeData | null {
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
        generationMode:
          (item.infiniteNodeMeta?.generationMode as "text" | "image" | "video" | "audio") ??
          "image",
        prompt: item.infiniteNodeMeta?.prompt ?? "",
      },
    };
  }
  if (item.url || item.outputId || item.assetId) {
    return canvasItemToNodeData(item);
  }
  return null;
}

/** 将 InfiniteCanvas 快照中的非 Drama 节点合并写回 canvasItems */
export function mergeSnapshotToCanvasItems(
  items: CanvasItem[],
  snapshotNodes: CanvasNodeData[],
): CanvasItem[] {
  const canvasNodes = snapshotNodes.filter(isPersistedCanvasNode);
  const nodeById = new Map(canvasNodes.map((n) => [n.id, n]));
  const kept: CanvasItem[] = [];

  for (const item of items) {
    const node = nodeById.get(item.id);
    if (!node) continue;
    if (item.infiniteNodeType) {
      kept.push({
        ...item,
        x: node.position.x,
        y: node.position.y,
        width: node.width,
        height: node.height,
        label: node.title ?? item.label,
        infiniteNodeMeta: {
          ...item.infiniteNodeMeta,
          content: node.metadata?.content ?? item.infiniteNodeMeta?.content,
          generationMode:
            node.metadata?.generationMode ?? item.infiniteNodeMeta?.generationMode,
          prompt: node.metadata?.prompt ?? item.infiniteNodeMeta?.prompt,
        },
      });
    } else {
      kept.push({
        ...item,
        x: node.position.x,
        y: node.position.y,
        width: node.width,
        height: node.height,
        label: node.title ?? item.label,
      });
    }
    nodeById.delete(item.id);
  }

  for (const node of nodeById.values()) {
    if (node.type === CanvasNodeType.Text || node.type === CanvasNodeType.Config) {
      kept.push(manualNodeToCanvasItem(node));
    } else if (node.type === CanvasNodeType.Image || node.type === CanvasNodeType.Video) {
      kept.push(nodeDataToCanvasItem(node));
    }
  }

  return kept;
}

export function buildAddNodeOp(
  nodeType: CanvasNodeType,
  worldX: number,
  worldY: number,
  title?: string,
): import("./utils").CanvasAgentOp {
  return {
    type: "add_node",
    id: `${nodeType}-${randomUUID()}`,
    nodeType,
    title,
    x: worldX,
    y: worldY,
  };
}

export function snapshotFromParts(
  items: CanvasItem[],
  dramaNodes: CanvasNodeData[],
  dramaConnections: CanvasConnection[],
  selectedNodeIds: string[],
  viewport: CanvasAgentSnapshot["viewport"],
  meta: Pick<CanvasAgentSnapshot, "projectId" | "title">,
): CanvasAgentSnapshot {
  const itemNodes = items
    .map(canvasItemToPersistedNode)
    .filter((n): n is CanvasNodeData => n != null);
  return {
    ...meta,
    nodes: [...itemNodes, ...dramaNodes],
    connections: [
      ...dramaConnections,
      // item connections rebuilt in design-canvas via buildConnectionsFromItems when needed
    ],
    selectedNodeIds,
    viewport,
  };
}

export function isDramaNodeId(nodeId: string): boolean {
  return nodeId.startsWith("drama-");
}
