"use client";

import { useCallback } from "react";
import type { DramaStoryboardShot } from "@/lib/types";

interface DramaStoryboardGridProps {
  shots: DramaStoryboardShot[];
  onRetryShot?: (shotId: string, stage: "keyframe" | "video") => void;
  readOnly?: boolean;
  editable?: boolean;
  onShotsChange?: (shots: DramaStoryboardShot[]) => void;
}

const STATUS_LABEL: Record<DramaStoryboardShot["status"], string> = {
  pending: "待生成",
  keyframe: "关键帧就绪",
  video: "视频就绪",
  audio: "配音就绪",
  done: "完成",
  failed: "失败",
};

/** RHTV 式分镜九宫格预览；草稿态可编辑对白/画面描述、删镜 */
export function DramaStoryboardGrid({
  shots,
  onRetryShot,
  readOnly,
  editable,
  onShotsChange,
}: DramaStoryboardGridProps) {
  const sorted = [...shots].sort((a, b) => a.order - b.order);

  const updateShot = useCallback(
    (shotId: string, patch: Partial<DramaStoryboardShot>) => {
      if (!onShotsChange) return;
      onShotsChange(
        shots.map((s) => (s.id === shotId ? { ...s, ...patch } : s)),
      );
    },
    [onShotsChange, shots],
  );

  const removeShot = useCallback(
    (shotId: string) => {
      if (!onShotsChange) return;
      const next = shots
        .filter((s) => s.id !== shotId)
        .map((s, i) => ({ ...s, order: i }));
      onShotsChange(next);
    },
    [onShotsChange, shots],
  );

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
      {sorted.map((shot) => (
        <div
          key={shot.id}
          className="flex flex-col rounded-lg border border-white/10 bg-white/[0.03] p-2 text-xs"
        >
          <div className="mb-1 flex items-center justify-between gap-1">
            <span className="font-medium text-zinc-200">镜 {shot.order + 1}</span>
            <span className="text-[10px] text-zinc-500">
              {shot.durationSec}s
            </span>
          </div>
          {editable && onShotsChange ? (
            <>
              <textarea
                className="min-h-[48px] w-full resize-none rounded border border-white/10 bg-black/30 p-1 text-[10px] text-zinc-300"
                value={shot.visualPrompt}
                onChange={(e) =>
                  updateShot(shot.id, { visualPrompt: e.target.value })
                }
                placeholder="画面描述"
              />
              <textarea
                className="mt-1 min-h-[32px] w-full resize-none rounded border border-white/10 bg-black/30 p-1 text-[10px] italic text-violet-300/90"
                value={shot.dialogue[0]?.line ?? ""}
                onChange={(e) => {
                  const line = e.target.value;
                  const characterId =
                    shot.dialogue[0]?.characterId ??
                    shot.characterIds[0] ??
                    "";
                  updateShot(shot.id, {
                    dialogue: line
                      ? [{ characterId, line }]
                      : [],
                  });
                }}
                placeholder="对白（可选）"
              />
              <button
                type="button"
                className="mt-1 text-[10px] text-red-400/80 hover:text-red-300"
                onClick={() => removeShot(shot.id)}
              >
                删除镜头
              </button>
            </>
          ) : (
            <>
              <p className="line-clamp-3 flex-1 text-zinc-400">
                {shot.visualPrompt}
              </p>
              {shot.dialogue[0]?.line ? (
                <p className="mt-1 line-clamp-2 text-[10px] italic text-violet-300/80">
                  「{shot.dialogue[0].line}」
                </p>
              ) : null}
            </>
          )}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">
              {STATUS_LABEL[shot.status]}
            </span>
            {shot.auditScore ? (
              <span className="text-[10px] text-emerald-400/80">
                角色{shot.auditScore.character ?? "—"}
              </span>
            ) : null}
          </div>
          {!readOnly && onRetryShot && shot.status !== "pending" ? (
            <button
              type="button"
              className="mt-1 rounded border border-white/10 px-1 py-0.5 text-[10px] text-zinc-400 hover:bg-white/5"
              onClick={() => onRetryShot(shot.id, "keyframe")}
            >
              重生成
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
