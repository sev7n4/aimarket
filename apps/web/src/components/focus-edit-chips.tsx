"use client";

import { Crosshair, X } from "lucide-react";
import type { FocusEditIntent, FocusPointChip } from "@/lib/focus-edit";
import { MAX_FOCUS_POINTS } from "@/lib/focus-edit";

interface FocusEditChipsProps {
  points: FocusPointChip[];
  intent: FocusEditIntent;
  recognizing?: boolean;
  onIntentChange: (intent: FocusEditIntent) => void;
  onRemove: (pointId: string) => void;
  onCancel?: () => void;
}

export function FocusEditChips({
  points,
  intent,
  recognizing = false,
  onIntentChange,
  onRemove,
  onCancel,
}: FocusEditChipsProps) {
  if (points.length === 0 && !recognizing) return null;

  return (
    <div
      data-testid="focus-edit-panel"
      className="mt-2 rounded-xl border border-purple-500/25 bg-purple-500/5 p-2.5"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-[11px] font-medium text-purple-200">
          <Crosshair className="size-3.5" strokeWidth={1.6} />
          焦点编辑
        </span>
        <span className="text-[10px] text-zinc-500">
          {points.length}/{MAX_FOCUS_POINTS}
        </span>
        {recognizing ? (
          <span className="text-[10px] text-zinc-500">识别中…</span>
        ) : null}
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => onIntentChange("edit")}
            className={`rounded-full px-2 py-0.5 text-[10px] transition ${
              intent === "edit"
                ? "bg-purple-500 text-white"
                : "bg-white/10 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            局部修改
          </button>
          <button
            type="button"
            onClick={() => onIntentChange("replace")}
            className={`rounded-full px-2 py-0.5 text-[10px] transition ${
              intent === "replace"
                ? "bg-purple-500 text-white"
                : "bg-white/10 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            对象替换
          </button>
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-200"
            >
              退出
            </button>
          ) : null}
        </div>
      </div>
      {points.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {points.map((p, i) => (
            <span
              key={p.pointId}
              data-testid={`focus-edit-chip-${i}`}
              className="inline-flex items-center gap-1 rounded-full border border-purple-400/30 bg-purple-500/15 px-2 py-0.5 text-[11px] text-purple-100"
            >
              <span className="text-[10px] text-purple-300/80">{i + 1}</span>
              {p.objectName}
              <button
                type="button"
                aria-label={`移除焦点 ${p.objectName}`}
                onClick={() => onRemove(p.pointId)}
                className="rounded-full p-0.5 text-purple-200/80 hover:bg-white/10 hover:text-white"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-zinc-500">
          在画布图片上点击要编辑的位置（最多 {MAX_FOCUS_POINTS} 个焦点）
        </p>
      )}
    </div>
  );
}
