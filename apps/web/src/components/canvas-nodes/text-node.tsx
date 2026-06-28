"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Type } from "lucide-react";
import type { CanvasNodeData } from "@/lib/canvas-node-types";
import { NODE_DEFAULT_PORTS } from "@/lib/canvas-node-types";

/** 文本节点：显示文本内容，0 输入 + 1 输出 */
function TextNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as CanvasNodeData;
  const ports = NODE_DEFAULT_PORTS.text;
  const outputPorts = ports.filter((p) => p.type === "output");

  return (
    <div
      className={`min-w-[140px] max-w-[220px] rounded-lg border bg-[#0f0f0f] px-3 py-2 shadow-md transition-shadow ${
        selected ? "border-amber-500/60 shadow-amber-500/20" : "border-white/10"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Type className="size-4 text-amber-400" />
        <span className="text-xs font-medium text-zinc-200">{nodeData.label}</span>
      </div>

      {nodeData.prompt ? (
        <p className="text-[10px] text-zinc-400 line-clamp-4">{nodeData.prompt}</p>
      ) : (
        <p className="text-[10px] text-zinc-600 italic">输入文本内容...</p>
      )}

      {outputPorts.map((port, i) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          style={{ top: `${20 + i * 20}px` }}
          className="!size-3 !border-2 !border-amber-400 !bg-amber-600"
        />
      ))}
    </div>
  );
}

export const TextNode = memo(TextNodeComponent);
