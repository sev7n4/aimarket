"use client";

import { Loader2, Play } from "lucide-react";
import { getWorkflowTool, isWorkflowToolId } from "@/lib/workflow-tool-registry";
import type { CanvasNodeData } from "@/components/infinite-canvas/types";

export const WORKFLOW_RUN_NODE_EVENT = "aimarket:workflow-run-node";

export function dispatchWorkflowRunNode(node: CanvasNodeData) {
  document.dispatchEvent(
    new CustomEvent(WORKFLOW_RUN_NODE_EVENT, { detail: { node } }),
  );
}

type WorkflowToolNodeContentProps = {
  node: CanvasNodeData;
};

export function WorkflowToolNodeContent({ node }: WorkflowToolNodeContentProps) {
  const toolType = node.metadata?.workflowToolType;
  const tool = toolType && isWorkflowToolId(toolType) ? getWorkflowTool(toolType) : null;
  const status = node.metadata?.status ?? "idle";
  const isRunning = status === "loading";
  const hasOutput = Boolean(node.metadata?.content?.trim());

  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center"
      data-testid={`workflow-node-content-${node.id}`}
    >
      <div className="text-xs font-medium text-violet-200">
        {tool?.label ?? node.title}
      </div>
      <p className="text-[10px] leading-relaxed text-zinc-500">
        {tool?.description ?? "工作流工具节点"}
      </p>
      {node.metadata?.connectedImageUrls?.length ? (
        <p className="text-[10px] text-emerald-500">
          已连接 {node.metadata.connectedImageUrls.length} 张参考图
        </p>
      ) : null}
      {hasOutput ? (
        <p className="text-[10px] text-zinc-400">已生成输出</p>
      ) : null}
      <button
        type="button"
        disabled={isRunning}
        data-testid={`workflow-node-run-${node.id}`}
        onClick={(e) => {
          e.stopPropagation();
          dispatchWorkflowRunNode(node);
        }}
        className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
      >
        {isRunning ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Play className="size-3.5" />
        )}
        {isRunning ? "生成中…" : "运行"}
      </button>
    </div>
  );
}
