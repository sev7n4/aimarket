"use client";

import { memo, useRef } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ImageIcon } from "lucide-react";
import { assetUrl } from "@/lib/api-client";
import type { CanvasNodeData } from "@/lib/canvas-node-types";
import { NODE_DEFAULT_PORTS } from "@/lib/canvas-node-types";

/** 图片节点：显示缩略图 + 参考图上传 */
function ImageNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as CanvasNodeData;
  const ports = NODE_DEFAULT_PORTS.image;
  const inputPorts = ports.filter((p) => p.type === "input");
  const outputPorts = ports.filter((p) => p.type === "output");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const thumbSrc = nodeData.assetId
    ? assetUrl(`/assets/${nodeData.assetId}`)
    : null;

  return (
    <div
      className={`min-w-[160px] rounded-lg border bg-[#0f0f0f] px-3 py-2 shadow-md transition-shadow ${
        selected ? "border-orange-500/60 shadow-orange-500/20" : "border-white/10"
      }`}
    >
      {inputPorts.map((port, i) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          style={{ top: `${20 + i * 20}px` }}
          className="!size-3 !border-2 !border-orange-400 !bg-orange-600"
        />
      ))}

      <div className="flex items-center gap-2 mb-2">
        <ImageIcon className="size-4 text-orange-400" />
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
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mb-1 flex h-20 w-full items-center justify-center rounded border border-dashed border-white/10 text-zinc-600 hover:border-orange-500/40 hover:text-orange-400 transition-colors"
        >
          <ImageIcon className="size-5" />
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="上传参考图"
      />

      {outputPorts.map((port, i) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          style={{ top: `${20 + i * 20}px` }}
          className="!size-3 !border-2 !border-orange-400 !bg-orange-600"
        />
      ))}
    </div>
  );
}

export const ImageNode = memo(ImageNodeComponent);
