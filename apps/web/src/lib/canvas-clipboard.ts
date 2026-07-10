import { randomUUID } from "@/lib/uuid";
import type {
  CanvasConnection,
  CanvasNodeData,
} from "@/components/infinite-canvas/types";

export type CanvasClipboardPayload = {
  nodes: CanvasNodeData[];
  connections: CanvasConnection[];
};

export function selectAllNodeIds(nodes: CanvasNodeData[]): string[] {
  return nodes.map((n) => n.id);
}

export function serializeSelection(
  nodes: CanvasNodeData[],
  connections: CanvasConnection[],
  selectedIds: string[],
): CanvasClipboardPayload | null {
  const idSet = new Set(selectedIds);
  if (idSet.size === 0) return null;
  const selectedNodes = nodes.filter((n) => idSet.has(n.id));
  if (selectedNodes.length === 0) return null;
  const selectedConnections = connections.filter(
    (c) => idSet.has(c.fromNodeId) && idSet.has(c.toNodeId),
  );
  return {
    nodes: selectedNodes.map((n) => ({
      ...n,
      metadata: n.metadata ? { ...n.metadata } : undefined,
    })),
    connections: selectedConnections.map((c) => ({ ...c })),
  };
}

export function pasteClipboard(
  payload: CanvasClipboardPayload,
  offset: { x: number; y: number } = { x: 40, y: 40 },
): { nodes: CanvasNodeData[]; connections: CanvasConnection[] } {
  const idMap = new Map<string, string>();
  const nodes = payload.nodes.map((node) => {
    const newId = `paste-${randomUUID()}`;
    idMap.set(node.id, newId);
    return {
      ...node,
      id: newId,
      position: {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y,
      },
      metadata: {
        ...node.metadata,
        status: "idle" as const,
        workflowJobId: undefined,
        workflowNodeKey: undefined,
        errorDetails: undefined,
      },
    };
  });

  const connections: CanvasConnection[] = [];
  for (const conn of payload.connections) {
    const fromNodeId = idMap.get(conn.fromNodeId);
    const toNodeId = idMap.get(conn.toNodeId);
    if (!fromNodeId || !toNodeId) continue;
    connections.push({
      id: `conn-${randomUUID()}`,
      fromNodeId,
      toNodeId,
    });
  }

  return { nodes, connections };
}
