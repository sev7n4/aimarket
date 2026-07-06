"use client";

import { Loader2, Plus, Send, Sparkles } from "lucide-react";

import { canvasTheme } from "./canvas-theme";

type InfiniteCanvasEmptyPromptProps = {
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
  onAddNode?: () => void;
  readOnly?: boolean;
  submitting?: boolean;
  submitLabel?: string;
};

/** Infinite 空画布：画布级创作入口（全局 Dock 隐藏时） */
export function InfiniteCanvasEmptyPrompt({
  prompt,
  onPromptChange,
  onSubmit,
  onAddNode,
  readOnly = false,
  submitting = false,
  submitLabel = "开始生成",
}: InfiniteCanvasEmptyPromptProps) {
  const canSubmit = Boolean(prompt.trim()) && !readOnly && !submitting;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-6"
      data-testid="infinite-canvas-empty-prompt"
    >
      <div
        className="pointer-events-auto w-full max-w-md overflow-hidden rounded-xl border shadow-2xl"
        style={{
          background: canvasTheme.toolbar.panel,
          borderColor: canvasTheme.toolbar.border,
        }}
      >
        <div
          className="flex items-center gap-2 border-b px-4 py-3"
          style={{ borderColor: canvasTheme.node.stroke }}
        >
          <Sparkles
            className="size-4 shrink-0"
            style={{ color: canvasTheme.node.activeStroke }}
          />
          <div>
            <p
              className="text-sm font-semibold"
              style={{ color: canvasTheme.node.text }}
            >
              节点画布
            </p>
            <p className="text-[11px]" style={{ color: canvasTheme.node.faint }}>
              输入描述开始生成，或添加空白节点
            </p>
          </div>
        </div>

        <div className="space-y-3 px-4 py-3">
          <textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing &&
                canSubmit
              ) {
                e.preventDefault();
                onSubmit();
              }
            }}
            placeholder={readOnly ? "只读会话" : "描述你想生成的图片或视频…"}
            rows={3}
            disabled={readOnly || submitting}
            className="w-full resize-none rounded-lg border px-3 py-2.5 text-sm outline-none transition placeholder:text-zinc-600 focus:border-violet-500/50 disabled:opacity-50"
            style={{
              background: canvasTheme.node.fill,
              borderColor: canvasTheme.node.stroke,
              color: canvasTheme.node.text,
            }}
            data-testid="infinite-empty-prompt-input"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-40"
              style={{
                background: canSubmit ? "#6366f1" : canvasTheme.node.fill,
                color: canSubmit ? "#fff" : canvasTheme.node.faint,
              }}
              data-testid="infinite-empty-submit"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {submitLabel}
            </button>
            {onAddNode ? (
              <button
                type="button"
                onClick={onAddNode}
                disabled={readOnly}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition hover:bg-white/5 disabled:opacity-40"
                style={{
                  borderColor: canvasTheme.node.stroke,
                  color: canvasTheme.node.muted,
                }}
                data-testid="infinite-empty-add-node"
              >
                <Plus className="size-4" />
                添加节点
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
