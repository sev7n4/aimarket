"use client";

import React, { useState, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";

import type { CanvasNodeData } from "../types";
import { CanvasNodeType } from "../types";
import { canvasTheme } from "../canvas-theme";

type DramaNodeChatProps = {
  node: CanvasNodeData;
  onSendCommand: (nodeId: string, command: string) => void;
  busy?: boolean;
};

const nodeTypeLabels: Record<string, string> = {
  [CanvasNodeType.Script]: "剧本",
  [CanvasNodeType.Shot]: "分镜",
  [CanvasNodeType.Character]: "角色",
  [CanvasNodeType.Scene]: "场景",
};

export function DramaNodeChat({ node, onSendCommand, busy = false }: DramaNodeChatProps) {
  const [input, setInput] = useState("");

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || busy) return;
    onSendCommand(node.id, trimmed);
    setInput("");
  }, [input, busy, node.id, onSendCommand]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const label = nodeTypeLabels[node.type] || "节点";

  return (
    <div
      className="border-t px-4 py-3"
      style={{ borderColor: canvasTheme.node.stroke }}
    >
      <div className="mb-2 text-[11px] font-medium" style={{ color: canvasTheme.node.faint }}>
        对话修改{label}
      </div>
      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`输入指令修改此${label}…`}
          rows={1}
          className="min-h-[28px] max-h-[80px] flex-1 resize-none rounded-lg border px-2.5 py-1.5 text-xs outline-none transition placeholder:text-zinc-600 focus:border-indigo-500/50"
          style={{
            background: canvasTheme.node.fill,
            borderColor: canvasTheme.node.stroke,
            color: canvasTheme.node.text,
          }}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!input.trim() || busy}
          className="flex size-7 shrink-0 items-center justify-center rounded-lg transition disabled:opacity-30"
          style={{
            background: input.trim() && !busy ? "#6366f1" : canvasTheme.node.fill,
            color: input.trim() && !busy ? "#fff" : canvasTheme.node.faint,
          }}
          aria-label="发送"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
