"use client";

import { useCallback } from "react";
import type { DramaStoryboardShot } from "@/lib/types";

interface DramaStoryboardGridProps {
  shots: DramaStoryboardShot[];
  onRetryShot?: (shotId: string, stage: "keyframe" | "video") => void;
  onPickKeyframe?: (shotId: string, heroIndex: number) => void;
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
  onPickKeyframe,
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

  const addShot = useCallback(() => {
    if (!onShotsChange || shots.length >= 15) return;
    const last = sorted[sorted.length - 1];
    const sceneId = last?.sceneId ?? shots[0]?.sceneId ?? "";
    const newShot: DramaStoryboardShot = {
      id: `shot_${Date.now()}`,
      order: shots.length,
      sceneId,
      characterIds: last?.characterIds ?? shots[0]?.characterIds ?? [],
      dialogue: [],
      visualPrompt: "新镜头画面描述",
      motionPrompt: "轻微运镜",
      cameraSpec: { shotSize: "MS", movement: "固定", lighting: "自然光" },
      durationSec: 5,
      useLastFrameContinuity: false,
      status: "pending",
    };
    onShotsChange([...shots, newShot]);
  }, [onShotsChange, shots, sorted]);

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
    <div className="space-y-2">
      {editable && onShotsChange && shots.length < 15 ? (
        <button
          type="button"
          className="rounded border border-dashed border-white/15 px-2 py-1 text-[10px] text-zinc-400 hover:bg-white/5"
          onClick={addShot}
        >
          + 添加镜头
        </button>
      ) : null}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
      {sorted.map((shot) => (
        <div
          key={shot.id}
          className="flex flex-col rounded-lg border border-white/10 bg-white/[0.03] p-2 text-xs"
        >
          {shot.keyframeVariantUrls && shot.keyframeVariantUrls.length > 1 ? (
            <div className="mb-1">
              <div className="mb-0.5 text-[10px] text-zinc-500">关键帧选优</div>
              <div className="flex gap-1 overflow-x-auto">
                {shot.keyframeVariantUrls.map((url, idx) => (
                  <button
                    key={`${shot.id}-variant-${idx}`}
                    type="button"
                    disabled={readOnly || !onPickKeyframe}
                    onClick={() => onPickKeyframe?.(shot.id, idx)}
                    className={`relative shrink-0 overflow-hidden rounded border ${
                      (shot.keyframeHeroIndex ?? 0) === idx
                        ? "border-violet-400 ring-1 ring-violet-400/50"
                        : "border-white/10 opacity-70 hover:opacity-100"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="aspect-[9/16] h-16 w-auto object-cover"
                    />
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-center text-[8px] text-zinc-300">
                      {idx + 1}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : shot.keyframeUrl || shot.videoUrl ? (
            <div className="mb-1 aspect-[9/16] overflow-hidden rounded bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.videoUrl ?? shot.keyframeUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}
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
          {!readOnly && onRetryShot && shot.status === "failed" ? (
            <div className="mt-2 flex flex-wrap gap-1">
              <button
                type="button"
                className="rounded border border-red-500/40 px-1.5 py-0.5 text-[10px] text-red-300 hover:bg-red-500/10"
                onClick={() => onRetryShot(shot.id, "keyframe")}
                data-testid="drama-shot-retry-keyframe"
              >
                重试此镜
              </button>
              <button
                type="button"
                className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-white/5"
                onClick={() => onRetryShot(shot.id, "video")}
                data-testid="drama-shot-retry-video"
              >
                重试视频
              </button>
            </div>
          ) : !readOnly && onRetryShot && shot.status !== "pending" ? (
            <button
              type="button"
              className="mt-1 rounded border border-white/10 px-1 py-0.5 text-[10px] text-zinc-400 hover:bg-white/5"
              onClick={() => onRetryShot(shot.id, "keyframe")}
              data-testid="drama-shot-retry"
            >
              重生成
            </button>
          ) : null}
        </div>
      ))}
      </div>
    </div>
  );
}
