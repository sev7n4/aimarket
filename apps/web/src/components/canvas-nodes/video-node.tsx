"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Video } from "lucide-react";
import { assetUrl } from "@/lib/api-client";
import type { CanvasNodeData } from "@/lib/canvas-node-types";
import { NODE_DEFAULT_PORTS } from "@/lib/canvas-node-types";

/** 视频节点：显示视频缩略图，输出 video + audio 双轨 */
function VideoNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as CanvasNodeData;
  const ports = NODE_DEFAULT_PORTS.video;
  const inputPorts = ports.filter((p) => p.type === "input");
  const outputPorts = ports.filter((p) => p.type === "output");

  const thumbSrc = nodeData.assetId
    ? assetUrl(`/assets/${nodeData.assetId}`)
    : null;

  return (
    <div
      className={`min-w-[180px] rounded-lg border bg-[#0f0f0f] px-3 py-2 shadow-md transition-shadow ${
        selected ? "border-cyan-500/60 shadow-cyan-500/20" : "border-white/10"
      }`}
    >
      {inputPorts.map((port, i) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          style={{ top: `${20 + i * 20}px` }}
          className="!size-3 !border-2 !border-cyan-400 !bg-cyan-600"
        />
      ))}

      <div className="flex items-center gap-2 mb-2">
        <Video className="size-4 text-cyan-400" />
        <span className="text-xs font-medium text-zinc-200">{nodeData.label}</span>
      </div>

      {thumbSrc ? (
        <div className="mb-1 overflow-hidden rounded border border-white/5">
          <img
            src={thumbSrc}
            alt={nodeData.label}
            className="h-24 w-full object-cover"
          />
        </div>
      ) : (
        <div className="mb-1 flex h-20 items-center justify-center rounded border border-dashed border-white/10">
          <Video className="size-5 text-zinc-600" />
        </div>
      )}

      {/* 双输出：video + audio，分上下排列 */}
      {outputPorts.map((port, i) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          style={{ top: `${30 + i * 24}px` }}
          className={`!size-3 !border-2 ${
            port.id === "output-audio"
              ? "!border-green-400 !bg-green-600"
              : "!border-cyan-400 !bg-cyan-600"
          }`}
        />
      ))}
    </div>
  );
}

export const VideoNode = memo(VideoNodeComponent);
