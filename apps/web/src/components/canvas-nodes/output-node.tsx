"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Sparkles, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import type { CanvasNodeData } from "@/lib/canvas-node-types";
import { NODE_DEFAULT_PORTS } from "@/lib/canvas-node-types";

/**
 * 输出节点：作为画布的终点节点，展示 Agent Run 的最终产物。
 * - params.runId: 关联的 Agent Run ID（可选）
 * - params.status: "idle" | "running" | "completed" | "failed"
 * - params.text: 文本结果（Agent 完成时回填）
 * - params.images: 图片结果 URL 列表
 */
function OutputNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as CanvasNodeData;
  const ports = NODE_DEFAULT_PORTS.output;
  const inputPorts = ports.filter((p) => p.type === "input");

  const params = (nodeData.params ?? {}) as {
    runId?: string;
    status?: "idle" | "running" | "completed" | "failed";
    text?: string;
    images?: string[];
    error?: string;
  };
  const status = params.status ?? "idle";

  const statusIcon = {
    idle: <Sparkles className="size-3 text-zinc-500" />,
    running: <Loader2 className="size-3 animate-spin text-indigo-400" />,
    completed: <CheckCircle2 className="size-3 text-emerald-400" />,
    failed: <AlertCircle className="size-3 text-red-400" />,
  }[status];

  const statusText = {
    idle: "等待运行",
    running: "Agent 运行中...",
    completed: "已完成",
    failed: "失败",
  }[status];

  return (
    <div
      className={`min-w-[180px] max-w-[260px] rounded-lg border bg-gradient-to-br from-[#0f0f0f] to-[#15151f] px-3 py-2 shadow-md transition-shadow ${
        selected
          ? "border-pink-500/60 shadow-pink-500/20"
          : "border-pink-500/20"
      }`}
    >
      {inputPorts.map((port, i) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          style={{ top: `${20 + i * 20}px` }}
          className="!size-3 !border-2 !border-pink-400 !bg-pink-600"
        />
      ))}

      <div className="flex items-center gap-2 mb-1.5">
        <Sparkles className="size-4 text-pink-400" />
        <span className="text-xs font-medium text-zinc-200 flex-1">
          {nodeData.label}
        </span>
        {statusIcon}
      </div>

      <div className="flex items-center justify-between text-[9px] text-zinc-500 mb-1">
        <span>{statusText}</span>
        {params.runId ? (
          <span className="font-mono opacity-60">
            {params.runId.slice(0, 8)}
          </span>
        ) : null}
      </div>

      {status === "completed" && params.text ? (
        <p className="mt-1 text-[10px] text-zinc-300 line-clamp-4 rounded bg-black/30 px-2 py-1.5">
          {params.text}
        </p>
      ) : null}

      {status === "failed" && params.error ? (
        <p className="mt-1 text-[10px] text-red-300 line-clamp-3 rounded bg-red-500/10 px-2 py-1.5">
          {params.error}
        </p>
      ) : null}

      {status === "completed" && params.images && params.images.length > 0 ? (
        <div className="mt-1 grid grid-cols-2 gap-1">
          {params.images.slice(0, 4).map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`output-${i}`}
              className="h-12 w-full rounded border border-white/5 object-cover"
            />
          ))}
        </div>
      ) : null}

      {status === "idle" ? (
        <p className="mt-1 text-[9px] text-zinc-600 italic">
          连入输入边后，Agent Run 完成后结果将自动填充到这里
        </p>
      ) : null}
    </div>
  );
}

export const OutputNode = memo(OutputNodeComponent);
