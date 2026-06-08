"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchProviderStatus } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { jobStatusLabel } from "@/lib/job-stream";

/** 单张文生图/图生图典型耗时（秒） */
const DEFAULT_ESTIMATE_SEC = 60;
/** 与 scroll-canvas 成品缩略图高度一致 */
const SLOT_THUMB_HEIGHT = "10.5rem";

interface CanvasGeneratingTimelineCardProps {
  status: string;
  prompt?: string | null;
  elapsedMs?: number;
  startedAt?: number | null;
  queueAhead?: number | null;
  onCancel?: () => void;
  /** 空画布：居中 pill + 小占位，无时间线大卡 */
  centered?: boolean;
}

function formatDurationShort(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  if (s < 60) return `${s}s`;
  const min = Math.floor(s / 60);
  return `${min}分${s % 60}s`;
}

function buildStatusLine(
  status: string,
  elapsedSec: number,
  remainingSec: number,
  queueAhead: number | null | undefined,
): string {
  if (status === "queued") {
    if (queueAhead == null) return "排队中";
    if (queueAhead <= 0) return "排队中 · 即将开始";
    return `排队中 · 前方 ${queueAhead} 个`;
  }
  if (status === "running") {
    if (elapsedSec <= 0) return "生成中";
    if (elapsedSec >= DEFAULT_ESTIMATE_SEC) {
      return `生成中 · 已 ${formatDurationShort(elapsedSec)} · 仍在推理`;
    }
    return `生成中 · 已 ${formatDurationShort(elapsedSec)} · 约剩 ${formatDurationShort(remainingSec)}`;
  }
  return jobStatusLabel(status);
}

function GeneratingPlaceholder({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-lg border border-dashed border-orange-500/35 bg-zinc-900/40 ${
        compact ? "aspect-square max-h-[min(40vh,14rem)] w-full max-w-[14rem]" : ""
      }`}
      style={compact ? undefined : { height: SLOT_THUMB_HEIGHT, aspectRatio: "1" }}
      aria-hidden
    >
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-zinc-800/50 via-transparent to-zinc-800/50" />
    </div>
  );
}

function GeneratingSlotBody({
  status,
  prompt,
  elapsedSec,
  remainingSec,
  queueAhead,
  progressPercent,
  canCancel,
  onCancel,
  providerHint,
  compact = false,
}: {
  status: string;
  prompt?: string | null;
  elapsedSec: number;
  remainingSec: number;
  queueAhead: number | null | undefined;
  progressPercent: number;
  canCancel: boolean;
  onCancel?: () => void;
  providerHint: string | null;
  compact?: boolean;
}) {
  const statusLine = buildStatusLine(
    status,
    elapsedSec,
    remainingSec,
    queueAhead,
  );

  return (
    <article
      data-testid="canvas-generating-timeline-card"
      className={`group/gen-slot min-w-0 ${compact ? "flex w-full max-w-md flex-col items-center" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div
        className={`flex items-center gap-2 ${compact ? "justify-center" : "justify-between"}`}
      >
        <div
          className={`flex min-w-0 items-center gap-1.5 ${
            compact
              ? "rounded-full border border-white/10 bg-[#141414]/90 px-3 py-1.5 shadow-lg backdrop-blur"
              : ""
          }`}
        >
          <Loader2 className="size-3.5 shrink-0 animate-spin text-orange-400" />
          <p className="truncate text-[12px] text-zinc-200">{statusLine}</p>
        </div>
        {canCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 text-[10px] text-zinc-500 transition hover:text-zinc-300"
          >
            取消
          </button>
        ) : null}
      </div>

      <div
        className={`mt-1.5 h-0.5 overflow-hidden rounded-full bg-white/10 ${
          compact ? "w-full max-w-md" : ""
        }`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
        aria-label="生成进度"
      >
        <div
          className={`h-full rounded-full bg-orange-500/80 transition-all duration-700 ${
            status === "queued" ? "animate-pulse" : ""
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div
        className={`mt-2 flex gap-2 ${compact ? "w-full max-w-md flex-col items-center" : "items-start"}`}
      >
        <GeneratingPlaceholder compact={compact} />
        {prompt && !compact ? (
          <p
            className="min-w-0 flex-1 line-clamp-2 text-[11px] leading-snug text-zinc-500"
            title={prompt}
          >
            {prompt}
          </p>
        ) : null}
      </div>

      <div
        className={`pointer-events-none mt-1.5 max-h-0 overflow-hidden opacity-0 transition-all duration-200 group-hover/gen-slot:pointer-events-auto group-hover/gen-slot:max-h-24 group-hover/gen-slot:opacity-100 ${
          compact ? "w-full max-w-md text-center" : ""
        }`}
      >
        <p className="text-[10px] leading-relaxed text-zinc-500">
          {prompt ? (
            <span className="block whitespace-pre-wrap">{prompt}</span>
          ) : null}
          {status === "queued" && queueAhead != null ? (
            <span className="mt-0.5 block">
              排队：{queueAhead <= 0 ? "即将开始处理" : `前方约 ${queueAhead} 个任务`}
            </span>
          ) : null}
          {status === "running" && elapsedSec > 0 ? (
            <span className="mt-0.5 block tabular-nums">
              已用时 {formatDurationShort(elapsedSec)}
              {elapsedSec < DEFAULT_ESTIMATE_SEC
                ? ` · 预计剩余约 ${formatDurationShort(remainingSec)}`
                : ""}
            </span>
          ) : null}
          {providerHint ? (
            <span className="mt-0.5 block text-zinc-600">{providerHint}</span>
          ) : null}
        </p>
      </div>
    </article>
  );
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
  const { user } = useAuth();
  const [tick, setTick] = useState(0);
  const [providerHint, setProviderHint] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "queued" && status !== "running") return;
    const timer = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void fetchProviderStatus()
      .then((p) => {
        if (!cancelled) setProviderHint(p.hint ?? null);
      })
      .catch(() => {
        if (!cancelled) setProviderHint(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

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

  const body = (
    <GeneratingSlotBody
      status={status}
      prompt={prompt}
      elapsedSec={elapsedSec}
      remainingSec={remainingSec}
      queueAhead={queueAhead}
      progressPercent={progressPercent}
      canCancel={canCancel}
      onCancel={onCancel}
      providerHint={providerHint}
      compact={centered}
    />
  );

  if (centered) {
    return (
      <div className="flex min-h-full w-full flex-col items-center justify-center gap-3 px-3 py-8">
        {body}
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
      <div className="min-w-0 flex-1">{body}</div>
    </section>
  );
}
