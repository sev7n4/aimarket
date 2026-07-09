import { randomUUID } from "@/lib/uuid";
import { CanvasNodeType } from "@/components/infinite-canvas/types";
import type { CanvasAgentOp } from "@/components/infinite-canvas/utils";
import { buildWorkflowNodeKey } from "@/lib/workflow-graph-sync";

export type WorkflowTemplateNode = {
  type: string;
  title: string;
  relX: number;
  relY: number;
  width: number;
  height: number;
  metadata?: Record<string, unknown>;
};

export type WorkflowTemplatePayload = {
  kind: "workflow";
  nodes: WorkflowTemplateNode[];
  connections: { fromNodeIndex: number; toNodeIndex: number }[];
};

export function serializeWorkflowSelection(
  nodes: {
    id: string;
    type: CanvasNodeType;
    title: string;
    position: { x: number; y: number };
    width: number;
    height: number;
    metadata?: Record<string, unknown>;
  }[],
  connections: { fromNodeId: string; toNodeId: string }[],
): WorkflowTemplatePayload {
  const minX = Math.min(...nodes.map((n) => n.position.x));
  const minY = Math.min(...nodes.map((n) => n.position.y));
  const indexById = new Map(nodes.map((n, i) => [n.id, i]));

  return {
    kind: "workflow",
    nodes: nodes.map((n) => ({
      type: n.type,
      title: n.title,
      relX: Math.round(n.position.x - minX),
      relY: Math.round(n.position.y - minY),
      width: n.width,
      height: n.height,
      metadata: n.metadata,
    })),
    connections: connections
      .filter((c) => indexById.has(c.fromNodeId) && indexById.has(c.toNodeId))
      .map((c) => ({
        fromNodeIndex: indexById.get(c.fromNodeId)!,
        toNodeIndex: indexById.get(c.toNodeId)!,
      })),
  };
}

export function workflowTemplateToOps(
  template: WorkflowTemplatePayload,
  sessionId: string,
  origin: { x: number; y: number } = { x: 120, y: 120 },
): CanvasAgentOp[] {
  const nodeIds: string[] = [];
  const ops: CanvasAgentOp[] = [];

  template.nodes.forEach((node, index) => {
    const id = `wf-tpl-${index}-${randomUUID()}`;
    nodeIds.push(id);
    const nodeType = Object.values(CanvasNodeType).includes(node.type as CanvasNodeType)
      ? (node.type as CanvasNodeType)
      : CanvasNodeType.Image;
    ops.push({
      type: "add_node",
      id,
      nodeType,
      title: node.title,
      x: origin.x + node.relX,
      y: origin.y + node.relY,
      width: node.width,
      height: node.height,
      metadata: {
        ...(node.metadata ?? {}),
        workflowNodeKey: buildWorkflowNodeKey(sessionId, id),
      },
    });
  });

  for (const conn of template.connections) {
    const fromNodeId = nodeIds[conn.fromNodeIndex];
    const toNodeId = nodeIds[conn.toNodeIndex];
    if (!fromNodeId || !toNodeId) continue;
    ops.push({ type: "connect_nodes", fromNodeId, toNodeId });
  }

  return ops;
}
