import {
  CanvasNodeType,
  type CanvasNodeData,
} from "@/components/infinite-canvas/types";
import {
  getWorkflowTool,
  isWorkflowToolId,
  type WorkflowMediaKind,
} from "@/lib/workflow-tool-registry";

export type ConnectionDropIntent = "connect" | "create-at-drop" | "cancel";

const MEDIA_KIND_LABELS: Record<WorkflowMediaKind, string> = {
  image: "图片",
  video: "视频",
  audio: "音频",
  text: "文本",
};

function mediaKindFromNodeType(type: CanvasNodeType): WorkflowMediaKind | null {
  switch (type) {
    case CanvasNodeType.Image:
      return "image";
    case CanvasNodeType.Video:
      return "video";
    case CanvasNodeType.Audio:
      return "audio";
    case CanvasNodeType.Text:
      return "text";
    default:
      return null;
  }
}

function getNodeOutputKind(node: CanvasNodeData): WorkflowMediaKind | null {
  const toolType = node.metadata?.workflowToolType;
  if (toolType && isWorkflowToolId(toolType)) {
    const tool = getWorkflowTool(toolType);
    if (tool?.outputKind) return tool.outputKind;
  }
  return mediaKindFromNodeType(node.type);
}

function getNodeInputKinds(node: CanvasNodeData): WorkflowMediaKind[] | null {
  const toolType = node.metadata?.workflowToolType;
  if (!toolType || !isWorkflowToolId(toolType)) {
    return null;
  }
  const tool = getWorkflowTool(toolType);
  return tool?.inputKinds ?? null;
}

export function canConnectNodes(
  source: CanvasNodeData,
  target: CanvasNodeData,
): { ok: boolean; reason?: string } {
  if (source.id === target.id) {
    return { ok: false, reason: "不能连接到自己" };
  }

  const targetInputKinds = getNodeInputKinds(target);
  if (targetInputKinds === null) {
    return { ok: true };
  }

  const sourceOutputKind = getNodeOutputKind(source);
  if (sourceOutputKind === null) {
    return { ok: true };
  }

  if (!targetInputKinds.includes(sourceOutputKind)) {
    return {
      ok: false,
      reason: `目标节点不接受${MEDIA_KIND_LABELS[sourceOutputKind]}输入`,
    };
  }

  return { ok: true };
}

export function connectionDropIntent(
  hitNodeId: string | null,
  _worldPos: { x: number; y: number },
): ConnectionDropIntent {
  if (hitNodeId) {
    return "connect";
  }
  return "create-at-drop";
}

export type ConnectionHandleSide = "source" | "target";

/** Resolve from/to node ids for a drag between handle and another node. */
export function resolveConnectionEndpoints(
  nodeId: string,
  handleType: ConnectionHandleSide,
  otherNodeId: string,
): { fromNodeId: string; toNodeId: string } {
  if (handleType === "source") {
    return { fromNodeId: nodeId, toNodeId: otherNodeId };
  }
  return { fromNodeId: otherNodeId, toNodeId: nodeId };
}

export function validateConnectionEndpoints(
  source: CanvasNodeData,
  target: CanvasNodeData,
): { ok: boolean; reason?: string } {
  return canConnectNodes(source, target);
}
