"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { jobStatusLabel } from "@/lib/job-stream";

/** 单张文生图/图生图典型耗时（秒），用于进度与预计剩余 */
const DEFAULT_ESTIMATE_SEC = 60;

interface CanvasGeneratingTimelineCardProps {
  status: string;
  prompt?: string | null;
  elapsedMs?: number;
  /** 任务开始时间戳；优先于 elapsedMs，用于本地秒级刷新 */
  startedAt?: number | null;
  queueAhead?: number | null;
  onCancel?: () => void;
  centered?: boolean;
}

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  if (s < 60) return `${s} 秒`;
  const min = Math.floor(s / 60);
  return `${min} 分 ${s % 60} 秒`;
}

function statusTone(status: string): string {
  if (status === "queued") return "text-amber-200";
  if (status === "running") return "text-orange-200";
  return "text-zinc-200";
}

export function CanvasGeneratingTimelineCard({
  status,
  prompt,
  elapsedMs,
  startedAt,
  queueAhead,
  onCancel,
  centered = false,
}: CanvasGeneratingTimelineCardProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (status !== "queued" && status !== "running") return;
    const timer = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  const elapsedSec = useMemo(() => {
    void tick;
    if (startedAt != null) {
      return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    }
    if (elapsedMs != null && elapsedMs > 0) {
      return Math.floor(elapsedMs / 1000);
    }
    return 0;
  }, [startedAt, elapsedMs, tick]);

  const canCancel =
    Boolean(onCancel) && (status === "queued" || status === "running");

  const progressPercent =
    status === "queued"
      ? queueAhead != null && queueAhead > 0
        ? 6
        : 12
      : Math.min(92, Math.max(14, Math.round((elapsedSec / DEFAULT_ESTIMATE_SEC) * 100)));

  const remainingSec = Math.max(0, DEFAULT_ESTIMATE_SEC - elapsedSec);

  const statusDetail =
    status === "queued"
      ? queueAhead == null
        ? "排队中，等待空闲算力"
        : queueAhead <= 0
          ? "即将开始处理"
          : `前方约 ${queueAhead} 个任务`
      : status === "running"
        ? elapsedSec > 0
          ? `已用时 ${formatDuration(elapsedSec)} · 预计剩余约 ${formatDuration(remainingSec)}`
          : "模型推理中，请稍候"
        : "处理中";

  const card = (
    <article
      data-testid="canvas-generating-timeline-card"
      className="rounded-xl border border-orange-500/20 bg-orange-500/[0.04] px-3 py-3 sm:px-4"
      role="status"
      aria-live="polite"
    >
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Loader2 className="size-4 shrink-0 animate-spin text-orange-400" />
          <div className="min-w-0">
            <p className={`text-[13px] font-medium ${statusTone(status)}`}>
              {jobStatusLabel(status)}
            </p>
            <p className="text-[11px] text-zinc-500">{statusDetail}</p>
          </div>
        </div>
        {canCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 rounded-md bg-white/10 px-2 py-1 text-[10px] text-zinc-300 transition hover:bg-white/15 hover:text-white"
          >
            取消
          </button>
        ) : null}
      </header>

      <div
        className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
        aria-label="生成进度"
      >
        <div
          className={`h-full rounded-full bg-gradient-to-r from-orange-500/80 to-orange-300/90 transition-all duration-700 ${
            status === "queued" ? "animate-pulse" : ""
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-zinc-500">
        <span>
          状态：
          <span className="text-zinc-300">{jobStatusLabel(status)}</span>
        </span>
        {status === "running" && elapsedSec > 0 ? (
          <span>
            已用时：
            <span className="tabular-nums text-zinc-300">
              {formatDuration(elapsedSec)}
            </span>
          </span>
        ) : null}
        {status === "running" ? (
          <span>
            预计：
            <span className="tabular-nums text-zinc-300">
              约 {formatDuration(remainingSec)}
            </span>
          </span>
        ) : null}
        {status === "queued" && queueAhead != null ? (
          <span>
            排队：
            <span className="text-zinc-300">
              {queueAhead <= 0 ? "即将开始" : `${queueAhead} 个`}
            </span>
          </span>
        ) : null}
      </div>

      {prompt ? (
        <p className="mb-3 line-clamp-2 text-[12px] leading-relaxed text-zinc-500">
          {prompt}
        </p>
      ) : null}

      <div
        className="relative aspect-[4/3] max-h-48 w-full overflow-hidden rounded-lg border border-white/10 bg-zinc-900/80"
        aria-hidden
      >
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-zinc-800/80 via-zinc-700/40 to-zinc-800/80" />
      </div>

      <p className="mt-2 text-[10px] text-zinc-600">
        完成后将自动定位到新图
      </p>
    </article>
  );

  if (centered) {
    return (
      <div className="flex min-h-full w-full items-center justify-center px-3 py-8">
        <div className="w-full max-w-md">{card}</div>
      </div>
    );
  }

  return (
    <section
      role="listitem"
      data-testid="canvas-generating-timeline-section"
      className="relative flex gap-2.5 sm:gap-3 pb-2"
    >
      <div className="relative z-[1] flex w-3 shrink-0 flex-col items-center pt-1">
        <span
          className="size-2.5 shrink-0 rounded-full bg-orange-400/90 shadow-[0_0_0_3px_rgba(9,9,11,0.95)] ring-2 ring-orange-500/50"
          aria-hidden
        />
      </div>
      <div className="min-w-0 flex-1">{card}</div>
    </section>
  );
}
