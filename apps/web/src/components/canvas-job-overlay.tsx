"use client";

import { Loader2 } from "lucide-react";
import { jobStatusLabel } from "@/lib/job-stream";

interface CanvasJobOverlayProps {
  status: string | null;
  failed?: boolean;
  /** 失败时的可读说明（优先于通用文案） */
  errorMessage?: string | null;
  onOpenChat?: () => void;
  onCancel?: () => void;
  /** 套图渐进：已完成张数 */
  completed?: number;
  /** 套图渐进：总张数 */
  total?: number;
  /** 自任务开始经过的毫秒数 */
  elapsedMs?: number;
  /** 前方排队任务数（queued 时） */
  queueAhead?: number | null;
}

function formatElapsed(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec} 秒`;
  const min = Math.floor(sec / 60);
  return `${min} 分 ${sec % 60} 秒`;
}

function formatQueueHint(queueAhead: number | null | undefined): string | null {
  if (queueAhead == null) return null;
  if (queueAhead <= 0) return "即将开始处理";
  return `前方约 ${queueAhead} 个任务`;
}

function formatEtaHint(
  status: string | null,
  elapsedMs: number | undefined,
  queueAhead: number | null | undefined,
): string | null {
  if (status === "queued") {
    const q = formatQueueHint(queueAhead);
    return q ?? "排队中，请稍候";
  }
  if (status === "running" && elapsedMs != null && elapsedMs > 0) {
    return `已用时 ${formatElapsed(elapsedMs)}`;
  }
  return null;
}

export function CanvasJobOverlay({
  status,
  failed,
  errorMessage,
  onOpenChat,
  onCancel,
  completed = 0,
  total = 0,
  elapsedMs,
  queueAhead,
}: CanvasJobOverlayProps) {
  if (!status && !failed) return null;

  const progressive = total > 1 && status === "running" && completed > 0;
  const showCorner = progressive;
  const canCancel =
    Boolean(onCancel) &&
    !failed &&
    (status === "queued" || status === "running");
  const subHint = formatEtaHint(status, elapsedMs, queueAhead);

  if (showCorner) {
    return (
      <div
        className="pointer-events-none absolute bottom-4 right-4 z-30"
        role="status"
        aria-live="polite"
      >
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-[#141414]/95 px-4 py-2 shadow-xl">
          <Loader2 className="size-4 shrink-0 animate-spin text-orange-400" />
          <span className="text-xs text-zinc-200">
            套图生成 {completed}/{total}
          </span>
          {canCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-white/20"
            >
              取消
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-30 flex items-center justify-center ${
        progressive ? "bg-transparent" : "bg-black/40 backdrop-blur-[2px]"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto mx-4 max-w-sm rounded-2xl border border-white/10 bg-[#141414]/95 px-5 py-4 shadow-2xl">
        {failed ?
          <>
            <p className="text-sm font-medium text-red-300">生成失败</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              {errorMessage ??
                "请打开对话区查看详情，或调整参考图与描述后重试"}
            </p>
            {onOpenChat ?
              <button
                type="button"
                onClick={onOpenChat}
                className="mt-3 rounded-full bg-white/10 px-4 py-1.5 text-xs text-zinc-200 hover:bg-white/15"
              >
                打开对话区
              </button>
            : null}
          </>
        : <div className="flex items-start gap-3">
            <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-orange-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-100">
                {total > 1 && completed > 0
                  ? `套图生成中 ${completed}/${total}`
                  : jobStatusLabel(status ?? "running")}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {subHint ??
                  (total > 1
                    ? "新图将逐张落在画布上"
                    : "完成后将自动定位到新图")}
              </p>
              {canCancel ? (
                <button
                  type="button"
                  onClick={onCancel}
                  className="mt-3 rounded-full bg-white/10 px-4 py-1.5 text-xs text-zinc-200 hover:bg-white/15"
                >
                  取消任务
                </button>
              ) : null}
            </div>
          </div>
        }
      </div>
    </div>
  );
}
