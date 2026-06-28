"use client";

import { useState } from "react";
import { GlassPanel, Button } from "@aimarket/ui";
import type { StudioTool } from "@/lib/types";
import type { CanvasItem } from "@/lib/canvas-tools";
import { assetUrl } from "@/lib/api-client";

/** 宫格切分参数面板 Props */
interface GridSplitPanelProps {
  tool: StudioTool;
  item: CanvasItem;
  pending?: boolean;
  onConfirm: (opts: { rows: number; cols: number }) => void;
  onClose: () => void;
}

const GRID_SIZES = [2, 3, 4, 5] as const;

export function GridSplitPanel({
  tool,
  item,
  pending = false,
  onConfirm,
  onClose,
}: GridSplitPanelProps) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="宫格切分"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <GlassPanel className="w-full max-w-sm p-4">
        <h2 className="text-sm font-medium text-zinc-100">
          精修 · {tool.name}
        </h2>
        <p className="mt-1 text-xs text-zinc-400">
          将宫格图切分为独立图片，每格输出一张
        </p>

        {/* 源图预览 */}
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] p-2">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-zinc-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={assetUrl(item.url)}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-zinc-300">当前选中图片</p>
            <p className="text-[11px] text-zinc-500">将作为切分源图</p>
          </div>
        </div>

        {/* 行列选择 */}
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-zinc-500">行数</p>
          <div className="flex gap-2">
            {GRID_SIZES.map((n) => (
              <button
                key={`row-${n}`}
                type="button"
                disabled={pending}
                onClick={() => setRows(n)}
                className={`flex-1 rounded-lg border py-1.5 text-xs transition ${
                  rows === n
                    ? "border-orange-500/60 bg-orange-500/15 text-orange-200"
                    : "border-white/10 text-zinc-400 hover:border-white/20"
                }`}
              >
                {n} 行
              </button>
            ))}
          </div>

          <p className="text-[11px] text-zinc-500">列数</p>
          <div className="flex gap-2">
            {GRID_SIZES.map((n) => (
              <button
                key={`col-${n}`}
                type="button"
                disabled={pending}
                onClick={() => setCols(n)}
                className={`flex-1 rounded-lg border py-1.5 text-xs transition ${
                  cols === n
                    ? "border-orange-500/60 bg-orange-500/15 text-orange-200"
                    : "border-white/10 text-zinc-400 hover:border-white/20"
                }`}
              >
                {n} 列
              </button>
            ))}
          </div>

          {/* 切分预览示意 */}
          <div className="mt-2 rounded-lg border border-dashed border-orange-500/25 bg-orange-500/[0.06] px-3 py-2 text-[11px] text-orange-200/90">
            将切分为 {rows}×{cols} = {rows * cols} 张独立图片
          </div>
        </div>

        {/* 积分预估 */}
        <p className="mt-3 text-[11px] text-zinc-500">
          1K · 预计消耗{" "}
          <span className="text-orange-300">5</span> 积分
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
            onClick={() => onConfirm({ rows, cols })}
          >
            {pending ? "切分中…" : "一键切分"}
          </Button>
        </div>
      </GlassPanel>
    </div>
  );
}
