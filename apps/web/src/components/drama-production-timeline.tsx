"use client";

import { useEffect, useMemo, useState } from "react";
import {
  activePipelineStep,
  computeProductionPercent,
  currentProductionLabel,
  isDramaRunProducing,
  SHOT_TRACK_SYMBOL,
  shotTrackState,
  sortShots,
} from "@/lib/drama-production-helpers";
import { shotDialogueLine } from "@/lib/drama-shot-helpers";
import type { DramaRun, DramaStoryboardShot } from "@/lib/types";

interface DramaProductionTimelineProps {
  run: DramaRun;
  busy?: boolean;
  onRetryShot?: (shotId: string, stage: "keyframe" | "video") => void;
  onPickKeyframe?: (shotId: string, heroIndex: number) => void;
}

const STATUS_LABEL: Record<DramaStoryboardShot["status"], string> = {
  pending: "待生成",
  keyframe: "关键帧就绪",
  video: "视频就绪",
  audio: "配音就绪",
  done: "完成",
  failed: "失败",
};

export function DramaProductionTimeline({
  run,
  busy,
  onRetryShot,
  onPickKeyframe,
}: DramaProductionTimelineProps) {
  const shots = useMemo(() => sortShots(run.project.shots), [run.project.shots]);
  const percent = computeProductionPercent(run);
  const currentLabel = currentProductionLabel(run);
  const pipelineStep = activePipelineStep(run);
  const producing = isDramaRunProducing(run);

  const [selectedId, setSelectedId] = useState<string | null>(shots[0]?.id ?? null);

  useEffect(() => {
    const activeShot = shots.find((s) => shotTrackState(s, run) === "active");
    if (activeShot) {
      setSelectedId(activeShot.id);
      return;
    }
    if (selectedId && !shots.some((s) => s.id === selectedId)) {
      setSelectedId(shots[0]?.id ?? null);
    }
  }, [run.updatedAt, run.status, shots, selectedId, run]);

  const selectedShot = shots.find((s) => s.id === selectedId) ?? null;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col rounded-xl border border-violet-500/20 bg-violet-500/[0.03] p-3 sm:p-4"
      data-testid="drama-production-timeline"
    >
      <header className="mb-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium text-violet-200">
              {producing ? "制作中" : run.status === "completed" ? "制作完成" : "制作进度"}
            </h3>
            {currentLabel ? (
              <p
                className="text-[11px] text-violet-300/90"
                data-testid="drama-production-current-step"
              >
                当前：{currentLabel}
                {run.status === "waiting_job" ? " · 等待任务" : ""}
              </p>
            ) : null}
          </div>
          <span
            className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] text-violet-200"
            data-testid="drama-production-percent"
          >
            {percent}%
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-black/40"
          data-testid="drama-production-progress-bar"
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              run.status === "failed"
                ? "bg-red-500/70"
                : run.status === "completed"
                  ? "bg-emerald-500/80"
                  : "bg-violet-500/80"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
        {pipelineStep ? (
          <p className="text-[10px] text-zinc-500">
            流水线：{pipelineStep.label}
            {run.pendingJobId
              ? ` · 任务 ${run.pendingJobId.slice(0, 8)}…`
              : ""}
          </p>
        ) : null}
      </header>

      <div
        className="mb-4 flex flex-wrap gap-2"
        data-testid="drama-production-shot-track"
      >
        {shots.map((shot) => {
          const track = shotTrackState(shot, run);
          const selected = shot.id === selectedId;
          return (
            <button
              key={shot.id}
              type="button"
              onClick={() => setSelectedId(shot.id)}
              data-testid={`drama-production-shot-${shot.order + 1}`}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] transition ${
                selected
                  ? "border-violet-400/50 bg-violet-500/15 text-violet-200"
                  : track === "done"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : track === "failed"
                      ? "border-red-500/30 bg-red-500/10 text-red-300"
                      : track === "active"
                        ? "border-violet-400/40 bg-violet-500/10 text-violet-300"
                        : "border-white/10 bg-black/20 text-zinc-500"
              }`}
            >
              <span>{SHOT_TRACK_SYMBOL[track]}</span>
              <span>S{shot.order + 1}</span>
            </button>
          );
        })}
      </div>

      {selectedShot ? (
        <section
          className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/5 bg-black/25 p-3"
          data-testid="drama-production-shot-detail"
        >
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <h4 className="text-xs font-medium text-zinc-300">
              S{selectedShot.order + 1} · {STATUS_LABEL[selectedShot.status]}
            </h4>
            {shotTrackState(selectedShot, run) === "active" ? (
              <span className="text-[10px] text-violet-300">进行中</span>
            ) : null}
          </div>

          {selectedShot.keyframeVariantUrls &&
          selectedShot.keyframeVariantUrls.length > 1 ? (
            <div className="mb-3">
              <div className="mb-1 text-[10px] text-zinc-500">关键帧选优</div>
              <div className="flex gap-2 overflow-x-auto">
                {selectedShot.keyframeVariantUrls.map((url, idx) => (
                  <button
                    key={`${selectedShot.id}-variant-${idx}`}
                    type="button"
                    disabled={busy || !onPickKeyframe}
                    onClick={() => onPickKeyframe?.(selectedShot.id, idx)}
                    className={`relative shrink-0 overflow-hidden rounded border ${
                      (selectedShot.keyframeHeroIndex ?? 0) === idx
                        ? "border-violet-400 ring-1 ring-violet-400/50"
                        : "border-white/10 opacity-80 hover:opacity-100"
                    }`}
                    data-testid={`drama-keyframe-variant-${idx}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="aspect-[9/16] h-24 w-auto object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {(selectedShot.videoUrl || selectedShot.keyframeUrl) && (
            <div className="mb-3 aspect-[9/16] max-h-48 w-full overflow-hidden rounded-lg bg-black/50 sm:max-w-[10rem]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedShot.videoUrl ?? selectedShot.keyframeUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <p className="text-[11px] text-zinc-400">{selectedShot.visualPrompt}</p>
          {shotDialogueLine(selectedShot) ? (
            <p className="mt-1 text-[10px] italic text-violet-300/80">
              「{shotDialogueLine(selectedShot)}」
            </p>
          ) : null}

          {selectedShot.status === "failed" && onRetryShot ? (
            <div
              className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2"
              data-testid="drama-shot-failed-panel"
            >
              <p className="mb-2 text-[11px] text-red-200/90">此镜生成失败</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRetryShot(selectedShot.id, "keyframe")}
                  className="rounded border border-red-500/40 px-2 py-1 text-[10px] text-red-200 hover:bg-red-500/10 disabled:opacity-50"
                  data-testid="drama-shot-retry-keyframe"
                >
                  重试关键帧
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRetryShot(selectedShot.id, "video")}
                  className="rounded border border-red-500/40 px-2 py-1 text-[10px] text-red-200 hover:bg-red-500/10 disabled:opacity-50"
                  data-testid="drama-shot-retry-video"
                >
                  重试此镜视频
                </button>
              </div>
            </div>
          ) : null}

          {selectedShot.status !== "failed" &&
          selectedShot.status !== "pending" &&
          onRetryShot &&
          producing ? (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                onRetryShot(
                  selectedShot.id,
                  selectedShot.status === "keyframe" ? "video" : "keyframe",
                )
              }
              className="mt-3 text-[10px] text-zinc-400 underline hover:text-zinc-300 disabled:opacity-50"
              data-testid="drama-shot-retry"
            >
              重新生成此镜
            </button>
          ) : null}
        </section>
      ) : null}

      {run.finalVideoUrl ? (
        <footer className="mt-3 border-t border-white/5 pt-3">
          <a
            href={run.finalVideoUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-sky-400 underline"
            data-testid="drama-final-video-link"
          >
            查看成片
          </a>
        </footer>
      ) : null}
    </div>
  );
}
