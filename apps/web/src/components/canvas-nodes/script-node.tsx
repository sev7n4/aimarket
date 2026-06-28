"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { FileCode } from "lucide-react";
import type { CanvasNodeData } from "@/lib/canvas-node-types";
import { NODE_DEFAULT_PORTS } from "@/lib/canvas-node-types";

/** 脚本节点：显示 label + prompt 输入 */
function ScriptNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as CanvasNodeData;
  const ports = NODE_DEFAULT_PORTS.script;
  const inputPorts = ports.filter((p) => p.type === "input");
  const outputPorts = ports.filter((p) => p.type === "output");

  return (
    <div
      className={`min-w-[180px] rounded-lg border bg-[#0f0f0f] px-3 py-2 shadow-md transition-shadow ${
        selected ? "border-violet-500/60 shadow-violet-500/20" : "border-white/10"
      }`}
    >
      {inputPorts.map((port, i) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          style={{ top: `${20 + i * 20}px` }}
          className="!size-3 !border-2 !border-violet-400 !bg-violet-600"
        />
      ))}

      <div className="flex items-center gap-2 mb-2">
        <FileCode className="size-4 text-violet-400" />
        <span className="text-xs font-medium text-zinc-200">{nodeData.label}</span>
      </div>

      {nodeData.prompt ? (
        <p className="text-[10px] text-zinc-400 line-clamp-3 mb-1">{nodeData.prompt}</p>
      ) : (
        <p className="text-[10px] text-zinc-600 italic mb-1">输入 prompt...</p>
      )}

      {outputPorts.map((port, i) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          style={{ top: `${20 + i * 20}px` }}
          className="!size-3 !border-2 !border-violet-400 !bg-violet-600"
        />
      ))}
    </div>
  );
}

export const ScriptNode = memo(ScriptNodeComponent);
