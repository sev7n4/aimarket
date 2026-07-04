"use client";

import React, { useCallback, useRef, useState } from "react";
import { Loader2, Send, Sparkles, X } from "lucide-react";

import { canvasTheme } from "./canvas-theme";
import { CanvasNodeType, type CanvasNodeData } from "./types";
import type { CanvasAgentOp, CanvasAgentSnapshot } from "./utils";
import { ALL_AGENT_TOOLS } from "./agent/agent-tools";
import { runCanvasAgentLoop } from "./agent/online-agent-loop";
import { isDramaNodeId } from "./sync-infinite-snapshot";

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
};

export function InfiniteNodeStudioDock({
  node,
  snapshot,
  onApplyOps,
  readOnly = false,
  onClose,
}: InfiniteNodeStudioDockProps) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const label = nodeTypeLabels[node.type] ?? "节点";
  const isDramaNode = isDramaNodeId(node.id);

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || busy || readOnly) return;

    setBusy(true);
    setStatus(null);

    try {
      const focusedSnapshot: CanvasAgentSnapshot = {
        ...snapshotRef.current,
        selectedNodeIds: [node.id],
      };
      const userMessage = isDramaNode
        ? `请只修改当前选中的节点（${node.id}，${node.title}）：${trimmed}`
        : `请基于当前选中的节点（${node.id}，${node.title}）执行：${trimmed}`;

      await runCanvasAgentLoop({
        snapshot: focusedSnapshot,
        userMessage,
        historyMessages: [],
        tools: ALL_AGENT_TOOLS,
        onApplyOps: (ops) => {
          const updated = onApplyOps(ops);
          snapshotRef.current = updated;
          return updated;
        },
        callbacks: {
          onAssistantMessage: (text) => setStatus(text.slice(0, 120)),
          onToolCallPending: () => setStatus("正在执行节点操作…"),
          onToolCallApproved: () => setStatus("节点已更新"),
          onToolCallRejected: () => setStatus("操作已取消"),
          onMaxStepsReached: () => setStatus("已达到最大步数"),
          onError: (message) => setStatus(message),
          onComplete: () => setStatus((prev) => prev ?? "完成"),
        },
      });
      setInput("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }, [busy, input, isDramaNode, node, onApplyOps, readOnly]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        void handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div
      data-testid="infinite-node-studio-dock"
      data-node-id={node.id}
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

      <div className="px-3 py-2.5">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              readOnly
                ? "只读会话"
                : `输入提示词，让 AI 修改此${label}或生成下一产物…`
            }
            rows={2}
            disabled={readOnly || busy}
            className="min-h-[52px] max-h-[120px] flex-1 resize-none rounded-lg border px-2.5 py-2 text-xs outline-none transition placeholder:text-zinc-600 focus:border-violet-500/50 disabled:opacity-50"
            style={{
              background: canvasTheme.node.fill,
              borderColor: canvasTheme.node.stroke,
              color: canvasTheme.node.text,
            }}
          />
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!input.trim() || busy || readOnly}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg transition disabled:opacity-30"
            style={{
              background:
                input.trim() && !busy && !readOnly
                  ? "#6366f1"
                  : canvasTheme.node.fill,
              color:
                input.trim() && !busy && !readOnly
                  ? "#fff"
                  : canvasTheme.node.faint,
            }}
            aria-label="发送"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </div>
        {status ? (
          <p
            className="mt-2 text-[10px] leading-relaxed"
            style={{ color: canvasTheme.node.muted }}
          >
            {status}
          </p>
        ) : null}
      </div>
    </div>
  );
}
