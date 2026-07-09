import type { CanvasNodeData } from "@/components/infinite-canvas/types";
import { isWorkflowToolId } from "@/lib/workflow-tool-registry";
import {
  storyCanvasBatchQueryStatus,
  type WorkflowNodeStatus,
} from "@/lib/api/story-canvas";

export function collectPendingWorkflowNodeKeys(
  nodes: CanvasNodeData[],
): string[] {
  return nodes
    .filter(
      (n) =>
        n.metadata?.workflowNodeKey &&
        n.metadata?.status === "loading",
    )
    .map((n) => n.metadata!.workflowNodeKey!)
    .filter(Boolean);
}

export function applyWorkflowStatusToNodes(
  nodes: CanvasNodeData[],
  statuses: Record<string, WorkflowNodeStatus>,
): { nodeId: string; patch: CanvasNodeData["metadata"] }[] {
  const patches: { nodeId: string; patch: CanvasNodeData["metadata"] }[] = [];

  for (const node of nodes) {
    const nodeKey = node.metadata?.workflowNodeKey;
    if (!nodeKey || !statuses[nodeKey]) continue;
    const st = statuses[nodeKey];
    if (st.status === "queued" || st.status === "running") continue;

    if (st.status === "succeeded" && st.outputUrl) {
      patches.push({
        nodeId: node.id,
        patch: {
          ...node.metadata,
          status: "success",
          content: st.outputUrl,
          workflowJobId: st.jobId,
        },
      });
    } else if (st.status === "failed") {
      patches.push({
        nodeId: node.id,
        patch: {
          ...node.metadata,
          status: "error",
          errorDetails: st.error ?? "生成失败",
          workflowJobId: st.jobId,
        },
      });
    }
  }

  return patches;
}

export async function pollWorkflowGenerationStatuses(
  sessionId: string,
  nodes: CanvasNodeData[],
): Promise<{ nodeId: string; patch: CanvasNodeData["metadata"] }[]> {
  const keys = collectPendingWorkflowNodeKeys(nodes);
  if (keys.length === 0) return [];
  const statuses = await storyCanvasBatchQueryStatus(sessionId, keys);
  return applyWorkflowStatusToNodes(nodes, statuses);
}

export function isWorkflowGenerationToolNode(node: CanvasNodeData): boolean {
  const t = node.metadata?.workflowToolType;
  return Boolean(t && isWorkflowToolId(t));
}
