"use client";

import { memo, useRef, useState, useCallback } from "react";
import {
  Handle,
  Position,
  useReactFlow,
  type NodeProps,
} from "@xyflow/react";
import { ImageIcon, Loader2 } from "lucide-react";
import { assetUrl, uploadAsset } from "@/lib/api-client";
import type { CanvasNodeData } from "@/lib/canvas-node-types";
import { NODE_DEFAULT_PORTS } from "@/lib/canvas-node-types";

/** 图片节点：显示缩略图 + 参考图上传 */
function ImageNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as CanvasNodeData;
  const ports = NODE_DEFAULT_PORTS.image;
  const inputPorts = ports.filter((p) => p.type === "input");
  const outputPorts = ports.filter((p) => p.type === "output");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { updateNodeData } = useReactFlow();
  const [uploading, setUploading] = useState(false);

  const thumbSrc = nodeData.assetId
    ? assetUrl(`/assets/${nodeData.assetId}`)
    : null;

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const asset = await uploadAsset(file);
        updateNodeData(id, {
          ...nodeData,
          assetId: asset.id,
          label: nodeData.label || file.name,
        });
      } catch (err) {
        console.error("[canvas] 图片上传失败:", err);
      } finally {
        setUploading(false);
        // 重置 input 允许重复上传同一文件
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [id, nodeData, updateNodeData],
  );

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
          disabled={uploading}
          className="mb-1 flex h-20 w-full items-center justify-center rounded border border-dashed border-white/10 text-zinc-600 hover:border-orange-500/40 hover:text-orange-400 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <ImageIcon className="size-5" />
          )}
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="上传参考图"
        onChange={handleFileChange}
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
