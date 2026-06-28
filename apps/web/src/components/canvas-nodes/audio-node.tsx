"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Music } from "lucide-react";
import type { CanvasNodeData } from "@/lib/canvas-node-types";
import { NODE_DEFAULT_PORTS } from "@/lib/canvas-node-types";

/** 音频节点：显示波形图标，0 输入 + 1 输出 */
function AudioNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as CanvasNodeData;
  const ports = NODE_DEFAULT_PORTS.audio;
  const outputPorts = ports.filter((p) => p.type === "output");

  return (
    <div
      className={`min-w-[140px] rounded-lg border bg-[#0f0f0f] px-3 py-2 shadow-md transition-shadow ${
        selected ? "border-green-500/60 shadow-green-500/20" : "border-white/10"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Music className="size-4 text-green-400" />
        <span className="text-xs font-medium text-zinc-200">{nodeData.label}</span>
      </div>

      {/* 波形占位 */}
      <div className="flex h-8 items-center justify-center gap-[2px]">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="w-[2px] rounded-full bg-green-500/40"
            style={{ height: `${8 + Math.sin(i * 0.8) * 10}px` }}
          />
        ))}
      </div>

      {outputPorts.map((port, i) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          style={{ top: `${20 + i * 20}px` }}
          className="!size-3 !border-2 !border-green-400 !bg-green-600"
        />
      ))}
    </div>
  );
}

export const AudioNode = memo(AudioNodeComponent);
