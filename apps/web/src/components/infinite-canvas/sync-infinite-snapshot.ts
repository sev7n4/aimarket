import type { CanvasItem } from "@/lib/canvas-tools";
import { randomUUID } from "@/lib/uuid";
import {
  canvasItemToNodeData,
  isLineageConnection,
  mergeCanvasConnections,
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

function workflowMetaFromNode(node: CanvasNodeData) {
  return {
    content: node.metadata?.content ?? "",
    generationMode: node.metadata?.generationMode ?? "image",
    prompt: node.metadata?.prompt ?? "",
    workflowToolType: node.metadata?.workflowToolType,
    workflowNodeKey: node.metadata?.workflowNodeKey,
    workflowJobId: node.metadata?.workflowJobId,
    connectedImageUrls: node.metadata?.connectedImageUrls,
    connectedVideoUrls: node.metadata?.connectedVideoUrls,
    connectedAudioUrls: node.metadata?.connectedAudioUrls,
  };
}

function workflowNodeToCanvasItem(node: CanvasNodeData): CanvasItem {
  const isVideo = node.type === CanvasNodeType.Video;
  const isAudio = node.type === CanvasNodeType.Audio;
  return {
    id: node.id,
    url: node.metadata?.content || "",
    x: node.position.x,
    y: node.position.y,
    width: node.width,
    height: node.height,
    isVideo,
    label: node.title,
    infiniteNodeType: "workflow",
    infiniteNodeMeta: {
      ...workflowMetaFromNode(node),
      generationMode: isVideo ? "video" : isAudio ? "audio" : "image",
    },
  };
}

function canvasItemToPersistedNode(item: CanvasItem): CanvasNodeData | null {
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
        content: item.url || meta?.content || "",
        status: meta?.workflowJobId ? "loading" : "idle",
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
          workflowToolType:
            node.metadata?.workflowToolType ?? item.infiniteNodeMeta?.workflowToolType,
          workflowNodeKey:
            node.metadata?.workflowNodeKey ?? item.infiniteNodeMeta?.workflowNodeKey,
          workflowJobId:
            node.metadata?.workflowJobId ?? item.infiniteNodeMeta?.workflowJobId,
          connectedImageUrls:
            node.metadata?.connectedImageUrls ?? item.infiniteNodeMeta?.connectedImageUrls,
          connectedVideoUrls:
            node.metadata?.connectedVideoUrls ?? item.infiniteNodeMeta?.connectedVideoUrls,
          connectedAudioUrls:
            node.metadata?.connectedAudioUrls ?? item.infiniteNodeMeta?.connectedAudioUrls,
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
    } else if (
      node.metadata?.workflowToolType &&
      (node.type === CanvasNodeType.Image ||
        node.type === CanvasNodeType.Video ||
        node.type === CanvasNodeType.Audio)
    ) {
      kept.push(workflowNodeToCanvasItem(node));
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

function isDramaConnection(conn: CanvasConnection): boolean {
  return isDramaNodeId(conn.fromNodeId) || isDramaNodeId(conn.toNodeId);
}

/** 从完整连线列表提取应写入 canvas_layout.infiniteConnections 的手动连线 */
export function extractPersistedConnections(
  connections: CanvasConnection[],
  items: CanvasItem[],
): CanvasConnection[] {
  const itemIds = new Set(items.map((item) => item.id));
  return connections.filter((conn) => {
    if (isLineageConnection(conn, items)) return false;
    if (isDramaConnection(conn)) return false;
    return itemIds.has(conn.fromNodeId) && itemIds.has(conn.toNodeId);
  });
}

/** 删除连线：血缘连线清除 sourceItemId，手动连线返回 delete_connections op */
export function buildDeleteConnectionOps(
  connectionId: string,
  items: CanvasItem[],
  manualConnections: CanvasConnection[],
  dramaConnections: CanvasConnection[],
): {
  itemPatches?: CanvasItem[];
  ops: import("./utils").CanvasAgentOp[];
} {
  const all = mergeCanvasConnections(items, manualConnections, dramaConnections);
  const conn = all.find((c) => c.id === connectionId);
  if (!conn) {
    return { ops: [] };
  }
  if (isLineageConnection(conn, items)) {
    return {
      itemPatches: items.map((item) =>
        item.id === conn.toNodeId
          ? { ...item, sourceItemId: undefined }
          : item,
      ),
      ops: [],
    };
  }
  if (isDramaConnection(conn)) {
    return { ops: [] };
  }
  return {
    ops: [{ type: "delete_connections", ids: [connectionId] }],
  };
}
