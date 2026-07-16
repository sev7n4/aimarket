"use client";

import React, { useCallback, useRef, useState } from "react";
import { Send, Sparkles, X } from "lucide-react";

import { OverflowIconRow, type OverflowIconAction } from "@/components/overflow-icon-row";
import { canvasTheme } from "./canvas-theme";
import { CanvasNodeType, type CanvasNodeData } from "./types";
import type { CanvasAgentOp, CanvasAgentSnapshot } from "./utils";

const nodeTypeLabels: Record<string, string> = {
  [CanvasNodeType.Script]: "剧本",
  [CanvasNodeType.Shot]: "分镜",
  [CanvasNodeType.Character]: "角色",
  [CanvasNodeType.Scene]: "场景",
  [CanvasNodeType.Image]: "图片",
  [CanvasNodeType.Video]: "视频",
  [CanvasNodeType.Text]: "文本",
  [CanvasNodeType.Audio]: "音频",
};

type InfiniteNodeStudioDockProps = {
  node: CanvasNodeData;
  snapshot: CanvasAgentSnapshot;
  onApplyOps: (ops: CanvasAgentOp[]) => CanvasAgentSnapshot;
  readOnly?: boolean;
  onClose?: () => void;
  /** 节点工具链（Studio 工具 + 节点菜单，已去重） */
  toolActions?: OverflowIconAction[];
};

export function InfiniteNodeStudioDock({
  node,
  onClose,
  toolActions = [],
}: InfiniteNodeStudioDockProps) {
  const [input, setInput] = useState("");
  const snapshotRef = useRef<CanvasAgentSnapshot | null>(null);

  const label = nodeTypeLabels[node.type] ?? "节点";

  const handleSubmit = useCallback(() => {
    void snapshotRef;
    setInput("");
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div
      data-testid="infinite-node-studio-dock"
      data-dock-node-id={node.id}
      className="pointer-events-auto w-[min(520px,calc(100vw-2rem))] overflow-hidden rounded-xl border shadow-2xl"
      style={{
        background: canvasTheme.toolbar.panel,
        borderColor: canvasTheme.toolbar.border,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="flex items-center gap-2 border-b px-3 py-2"
        style={{ borderColor: canvasTheme.node.stroke }}
      >
        <Sparkles
          className="size-3.5 shrink-0"
          style={{ color: canvasTheme.node.activeStroke }}
        />
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-xs font-semibold"
            style={{ color: canvasTheme.node.text }}
          >
            {node.title || label}
          </p>
          <p className="text-[10px]" style={{ color: canvasTheme.node.faint }}>
            {label} · 节点创作台
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 transition hover:bg-white/10"
            aria-label="关闭节点创作台"
          >
            <X className="size-3.5" style={{ color: canvasTheme.node.faint }} />
          </button>
        ) : null}
      </div>

      {toolActions.length > 0 ? (
        <div
          className="border-b px-2 py-1.5"
          style={{ borderColor: canvasTheme.node.stroke }}
          data-testid="infinite-node-toolchain"
        >
          <OverflowIconRow actions={toolActions} maxVisible={8} size="sm" align="start" />
        </div>
      ) : null}

      <div className="px-3 py-2.5">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="节点 Agent 对话已下线"
            rows={2}
            disabled
            className="min-h-[52px] max-h-[120px] flex-1 resize-none rounded-lg border px-2.5 py-2 text-xs outline-none transition placeholder:text-zinc-600 disabled:opacity-50"
            style={{
              background: canvasTheme.node.fill,
              borderColor: canvasTheme.node.stroke,
              color: canvasTheme.node.text,
            }}
          />
          <button
            type="button"
            disabled
            className="flex size-8 shrink-0 items-center justify-center rounded-lg transition disabled:opacity-30"
            style={{
              background: canvasTheme.node.fill,
              color: canvasTheme.node.faint,
            }}
            aria-label="发送"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
