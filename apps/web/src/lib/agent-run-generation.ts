import { CanvasNodeType, type CanvasNodeData } from "@/components/infinite-canvas/types";
import type { CanvasAgentOp } from "@/components/infinite-canvas/utils";
import { isDramaShotNode } from "@/lib/infinite-node-tool-run";

export type AgentGenerationMode = "text" | "image" | "video" | "audio";

export type AgentRunGenerationRequest = {
  node: CanvasNodeData;
  mode?: AgentGenerationMode;
  prompt?: string;
};

/** 将 add_node 后紧跟的 run_generation（空 nodeId）绑定到新建节点 id */
export function bindRunGenerationNodeIds(ops: CanvasAgentOp[]): CanvasAgentOp[] {
  let lastCreatedNodeId: string | null = null;

  return ops.map((op, index) => {
    if (op.type === "add_node") {
      const nodeType = Object.values(CanvasNodeType).includes(op.nodeType as CanvasNodeType)
        ? (op.nodeType as CanvasNodeType)
        : CanvasNodeType.Text;
      const id = op.id || `${nodeType}-${Date.now()}-${index}`;
      lastCreatedNodeId = id;
      return op.id ? op : { ...op, id };
    }

    if (op.type === "run_generation" && !op.nodeId && lastCreatedNodeId) {
      return { ...op, nodeId: lastCreatedNodeId };
    }

    return op;
  });
}

export function resolveAgentGenerationMode(
  node: CanvasNodeData,
  opMode?: AgentGenerationMode,
): AgentGenerationMode | null {
  if (opMode) return opMode;
  if (node.metadata?.generationMode) return node.metadata.generationMode;
  if (node.type === CanvasNodeType.Video) return "video";
  if (node.type === CanvasNodeType.Image) return "image";
  if (node.type === CanvasNodeType.Config) return node.metadata?.generationMode ?? "image";
  if (isDramaShotNode(node)) return "image";
  if (node.type === CanvasNodeType.Text) return "text";
  return null;
}

export function collectRunGenerationRequests(
  nodes: CanvasNodeData[],
  ops: CanvasAgentOp[],
): AgentRunGenerationRequest[] {
  const bound = bindRunGenerationNodeIds(ops);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const requests: AgentRunGenerationRequest[] = [];

  for (const op of bound) {
    if (op.type !== "run_generation" || !op.nodeId) continue;
    const node = nodeById.get(op.nodeId);
    if (!node) continue;
    requests.push({
      node,
      mode: op.mode,
      prompt: op.prompt,
    });
  }

  return requests;
}
