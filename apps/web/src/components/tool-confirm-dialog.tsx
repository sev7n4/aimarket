"use client";

import { useState } from "react";
import { GlassPanel, Button } from "@aimarket/ui";
import type { StudioTool } from "@/lib/types";
import {
  TOOL_GRID_HINTS,
  estimateToolPointsClient,
  toolRefineSpecLine,
} from "@/lib/studio-tool-meta";
import { resolveToolResolution } from "@/lib/tool-resolution";

export interface ToolConfirmRequest {
  tool: StudioTool;
  /** 变体默认 2 张 */
  defaultCount?: number;
}

interface ToolConfirmDialogProps {
  request: ToolConfirmRequest | null;
  onClose: () => void;
  onConfirm: (opts: { count: number }) => void;
  pending?: boolean;
}

const VARIATION_COUNTS = [1, 2, 4] as const;

export function ToolConfirmDialog({
  request,
  onClose,
  onConfirm,
  pending = false,
}: ToolConfirmDialogProps) {
  const [count, setCount] = useState(2);

  if (!request) return null;

  const { tool } = request;
  const resolution = resolveToolResolution(tool.id);
  const isVariation = tool.id === "variation";
  const effectiveCount = isVariation ? count : 1;
  const hint = TOOL_GRID_HINTS[tool.id];
  const points = estimateToolPointsClient(tool, resolution, effectiveCount);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tool-confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <GlassPanel className="w-full max-w-sm p-4">
        <h2
          id="tool-confirm-title"
          className="text-sm font-medium text-zinc-100"
        >
          精修 · {tool.name}
        </h2>
        <p className="mt-1 text-xs text-zinc-400">
          {tool.description ||
            "基于当前选中图片执行工具链，不使用左侧生成面板的模型与数量设置。"}
        </p>
        {hint ? (
          <p className="mt-2 text-[11px] text-zinc-500">{hint}</p>
        ) : null}
        {isVariation ? (
          <div className="mt-3">
            <p className="mb-1.5 text-[11px] text-zinc-500">
              同构图微差（细节/光影可见变化，非完全随机新图）
            </p>
            <div className="flex gap-2">
              {VARIATION_COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={pending}
                  onClick={() => setCount(n)}
                  className={`flex-1 rounded-lg border py-1.5 text-xs transition ${
                    count === n
                      ? "border-orange-500/60 bg-orange-500/15 text-orange-200"
                      : "border-white/10 text-zinc-400 hover:border-white/20"
                  }`}
                >
                  {n} 张
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <p className="mt-3 text-[11px] text-zinc-500">
          {toolRefineSpecLine(tool, resolution, effectiveCount)} · 预计消耗{" "}
          <span className="text-orange-300">{points}</span> 积分
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={onClose}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={pending}
            onClick={() => onConfirm({ count: effectiveCount })}
          >
            {pending ? "执行中…" : "确认执行"}
          </Button>
        </div>
      </GlassPanel>
    </div>
  );
}
