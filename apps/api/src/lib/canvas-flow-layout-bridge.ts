import { randomUUID } from "node:crypto";
import type {
  CanvasFlow,
  CanvasFlowEdge,
  CanvasFlowNode,
  CanvasNodeType,
} from "./canvas-flow-store.js";
import {
  type CanvasLayout,
  parseCanvasLayout,
  serializeCanvasLayout,
} from "./canvas-layout.js";

/** 无 url 的手动节点占位（满足 schema min(1)） */
export const CANVAS_PLACEHOLDER_URL = "https://canvas.aimarket.local/placeholder";

const DEFAULT_LABELS: Record<CanvasNodeType, string> = {
  script: "脚本",
  image: "图片",
  video: "视频",
  audio: "音频",
  text: "文本",
  output: "输出",
};

type LayoutItem = CanvasLayout["items"][number] & {
  infiniteNodeType?: "text" | "config";
};

function flowTypeFromItem(item: LayoutItem): CanvasNodeType | null {
  if (item.infiniteNodeType === "text") return "text";
  if (item.infiniteNodeType === "config") return "output";
  if (item.isVideo) return "video";
  if (item.url && item.url !== CANVAS_PLACEHOLDER_URL) {
    return item.isVideo ? "video" : "image";
  }
  return null;
}

function itemFromFlowNode(node: CanvasFlowNode): LayoutItem {
  const label =
    (typeof node.data?.label === "string" && node.data.label) ||
    DEFAULT_LABELS[node.type];
  const base = {
    id: node.id,
    x: node.position.x,
    y: node.position.y,
    width: 280,
    height: 200,
    label,
  };

  if (node.type === "text") {
    return {
      ...base,
      url: CANVAS_PLACEHOLDER_URL,
      infiniteNodeType: "text",
    };
  }
  if (node.type === "output") {
    return {
      ...base,
      url: CANVAS_PLACEHOLDER_URL,
      infiniteNodeType: "config",
    };
  }
  if (node.type === "video") {
    return {
      ...base,
      url: CANVAS_PLACEHOLDER_URL,
      isVideo: true,
    };
  }
  if (node.type === "audio") {
    return {
      ...base,
      url: CANVAS_PLACEHOLDER_URL,
    };
  }
  if (node.type === "script") {
    return {
      ...base,
      url: CANVAS_PLACEHOLDER_URL,
      infiniteNodeType: "text",
      label: label || "脚本",
    };
  }
  return {
    ...base,
    url: CANVAS_PLACEHOLDER_URL,
    assetId:
      typeof node.data?.assetId === "string" ? node.data.assetId : undefined,
    outputId:
      typeof node.data?.outputId === "string" ? node.data.outputId : undefined,
  };
}

/** canvas_layout → 旧 canvas_flow 结构（兼容 REST / MCP） */
export function canvasLayoutToFlow(layout: CanvasLayout): CanvasFlow {
  const nodes: CanvasFlowNode[] = [];
  const edges: CanvasFlowEdge[] = [];

  for (const item of layout.items as LayoutItem[]) {
    const type = flowTypeFromItem(item);
    if (!type) continue;
    nodes.push({
      id: item.id,
      type,
      position: { x: item.x, y: item.y },
      data: {
        type,
        label: item.label ?? DEFAULT_LABELS[type],
        assetId: item.assetId,
        outputId: item.outputId,
      },
    });
  }

  for (const item of layout.items) {
    if (item.sourceItemId) {
      edges.push({
        id: `lineage-${item.id}`,
        source: item.sourceItemId,
        target: item.id,
        kind: "reference",
      });
    }
  }

  for (const conn of layout.infiniteConnections ?? []) {
    edges.push({
      id: conn.id,
      source: conn.fromNodeId,
      target: conn.toNodeId,
      kind: "trigger",
    });
  }

  return { nodes, edges };
}

/** 将 canvas_flow 节点/边写回 canvas_layout（保留 dramaNodePositions） */
export function applyFlowToLayout(layout: CanvasLayout, flow: CanvasFlow): CanvasLayout {
  const flowNodeIds = new Set(flow.nodes.map((n) => n.id));
  const preserved = (layout.items as LayoutItem[]).filter(
    (item) => !flowNodeIds.has(item.id) && flowTypeFromItem(item) == null,
  );
  const flowItems = flow.nodes.map(itemFromFlowNode);

  const infiniteConnections = flow.edges
    .filter((e) => e.kind !== "reference")
    .map((e) => ({
      id: e.id,
      fromNodeId: e.source,
      toNodeId: e.target,
    }));

  const itemsWithLineage = flowItems.map((item) => {
    const lineage = flow.edges.find(
      (e) => e.kind === "reference" && e.target === item.id,
    );
    return lineage ? { ...item, sourceItemId: lineage.source } : item;
  });

  return {
    version: 1,
    items: [...preserved, ...itemsWithLineage].slice(0, 80),
    infiniteConnections:
      infiniteConnections.length > 0 ? infiniteConnections : undefined,
    dramaNodePositions: layout.dramaNodePositions,
  };
}

export function readCanvasLayoutFromDb(
  row: { canvas_layout: string | null; canvas_flow?: string | null } | undefined,
): CanvasLayout {
  const fromLayout = parseCanvasLayout(row?.canvas_layout ?? null);
  if (fromLayout && fromLayout.items.length > 0) {
    return fromLayout;
  }
  if (row?.canvas_flow) {
    try {
      const legacy = JSON.parse(row.canvas_flow) as CanvasFlow;
      return applyFlowToLayout({ version: 1, items: [] }, legacy);
    } catch {
      // fall through
    }
  }
  return fromLayout ?? { version: 1, items: [] };
}

export function newFlowNodeId(): string {
  return randomUUID();
}

export function serializeLayout(layout: CanvasLayout): string {
  return serializeCanvasLayout(layout);
}
