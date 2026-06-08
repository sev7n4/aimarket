"use client";

import { Loader2 } from "lucide-react";
import { jobStatusLabel } from "@/lib/job-stream";

interface CanvasGeneratingTimelineCardProps {
  status: string;
  prompt?: string | null;
  elapsedMs?: number;
  queueAhead?: number | null;
  onCancel?: () => void;
  /** 空画布时居中展示，不挡历史批次 */
  centered?: boolean;
}

function formatElapsed(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec} 秒`;
  const min = Math.floor(sec / 60);
  return `${min} 分 ${sec % 60} 秒`;
}

function formatSubHint(
  status: string,
  elapsedMs: number | undefined,
  queueAhead: number | null | undefined,
): string {
  if (status === "queued") {
    if (queueAhead == null) return "排队中，请稍候";
    if (queueAhead <= 0) return "即将开始处理";
    return `前方约 ${queueAhead} 个任务`;
  }
  if (status === "running" && elapsedMs != null && elapsedMs > 0) {
    return `已用时 ${formatElapsed(elapsedMs)}`;
  }
  return "完成后将自动定位到新图";
}

export function CanvasGeneratingTimelineCard({
  status,
  prompt,
  elapsedMs,
  queueAhead,
  onCancel,
  centered = false,
}: CanvasGeneratingTimelineCardProps) {
  const canCancel =
    Boolean(onCancel) && (status === "queued" || status === "running");
  const subHint = formatSubHint(status, elapsedMs, queueAhead);

  const card = (
    <article
      data-testid="canvas-generating-timeline-card"
      className="rounded-xl border border-orange-500/20 bg-orange-500/[0.04] px-3 py-3 sm:px-4"
      role="status"
      aria-live="polite"
    >
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Loader2 className="size-4 shrink-0 animate-spin text-orange-400" />
          <span className="text-[13px] font-medium text-zinc-100">
            {jobStatusLabel(status)}
          </span>
        </div>
        {canCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md bg-white/10 px-2 py-1 text-[10px] text-zinc-300 transition hover:bg-white/15 hover:text-white"
          >
            取消
          </button>
        ) : null}
      </header>

      {prompt ? (
        <p className="mb-3 line-clamp-2 text-[12px] leading-relaxed text-zinc-500">
          {prompt}
        </p>
      ) : null}

      <div
        className="relative mb-2 aspect-[4/3] max-h-48 w-full overflow-hidden rounded-lg border border-white/10 bg-zinc-900/80"
        aria-hidden
      >
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-zinc-800/80 via-zinc-700/40 to-zinc-800/80" />
      </div>

      <p className="text-[11px] text-zinc-500">{subHint}</p>
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
