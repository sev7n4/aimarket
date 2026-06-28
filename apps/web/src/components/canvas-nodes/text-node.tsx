"use client";

import { memo, useState, useCallback } from "react";
import {
  Handle,
  Position,
  useReactFlow,
  type NodeProps,
} from "@xyflow/react";
import { Type } from "lucide-react";
import type { CanvasNodeData } from "@/lib/canvas-node-types";
import { NODE_DEFAULT_PORTS } from "@/lib/canvas-node-types";

/** 文本节点：显示文本内容，双击可内联编辑 */
function TextNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as CanvasNodeData;
  const ports = NODE_DEFAULT_PORTS.text;
  const outputPorts = ports.filter((p) => p.type === "output");
  const { updateNodeData } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(nodeData.prompt ?? "");

  const handleSave = useCallback(() => {
    updateNodeData(id, { ...nodeData, prompt: draft });
    setEditing(false);
  }, [id, draft, nodeData, updateNodeData]);

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

      {editing ? (
        <div>
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSave();
              }
              if (e.key === "Escape") {
                setDraft(nodeData.prompt ?? "");
                setEditing(false);
              }
            }}
            className="w-full resize-none rounded border border-amber-500/40 bg-[#1a1a1a] px-2 py-1 text-[10px] text-zinc-200 outline-none focus:border-amber-500"
            rows={3}
            placeholder="输入文本内容..."
          />
          <p className="mt-0.5 text-[8px] text-zinc-600">Enter 保存 · Esc 取消</p>
        </div>
      ) : (
        <p
          className="cursor-text text-[10px] text-zinc-400 line-clamp-4"
          onDoubleClick={() => {
            setDraft(nodeData.prompt ?? "");
            setEditing(true);
          }}
          title="双击编辑"
        >
          {nodeData.prompt || "双击输入文本内容..."}
        </p>
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
