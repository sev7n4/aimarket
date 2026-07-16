"use client";

import { Check, Loader2, X } from "lucide-react";
import type {
  OrchestrationTimelineActions,
  OrchestrationTimelineEvent,
} from "@/lib/canvas-timeline";

const STATUS_LABEL: Record<string, string> = {
  preview: "计划预览",
  queued: "排队中",
  waiting_confirm: "待确认",
  running: "执行中",
  waiting_job: "生成中",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

interface ScrollCanvasOrchestrationCardProps {
  event: OrchestrationTimelineEvent;
  actions?: OrchestrationTimelineActions;
}

export function ScrollCanvasOrchestrationCard({
  event,
  actions,
}: ScrollCanvasOrchestrationCardProps) {
  const statusLabel = STATUS_LABEL[event.status] ?? event.status;
  const readOnly = actions?.readOnly ?? false;
  const confirmBusy = actions?.confirmBusy ?? false;

  return (
    <article
      data-testid={`orchestration-timeline-${event.id}`}
      className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 sm:px-4"
    >
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-medium text-zinc-200">{event.title}</h3>
        <span className="text-[11px] text-zinc-500">{statusLabel}</span>
      </header>

      {event.prompt ? (
        <p className="mb-3 line-clamp-3 text-[12px] leading-relaxed text-zinc-500">
          {event.prompt}
        </p>
      ) : null}

      {event.planLoading ? (
        <p className="flex items-center gap-2 text-xs text-zinc-500">
          <Loader2 className="size-3.5 animate-spin text-orange-400/90" />
          Agent 分析意图中…
        </p>
      ) : null}

      {!event.planLoading && event.steps.length > 0 ? (
        <ol className="space-y-1.5">
          {event.steps.map((step, i) => (
            <li
              key={`${step.type}-${step.label}-${i}`}
              className={`flex items-center gap-2 text-xs ${
                step.current
                  ? "text-orange-300"
                  : step.done
                    ? "text-zinc-500"
                    : "text-zinc-400"
              }`}
            >
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                  step.current
                    ? "bg-orange-500/20 text-orange-200"
                    : step.done
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-white/10 text-zinc-300"
                }`}
              >
                {step.done ? (
                  <Check className="size-3" />
                ) : step.current ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  i + 1
                )}
              </span>
              <span>
                {step.type === "tool"
                  ? "工具"
                  : step.type === "video"
                    ? "视频"
                    : step.type === "generate_set"
                      ? "套图"
                      : "生成"}
                {" · "}
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {event.planReason ? (
        <p className="mt-2 text-[11px] text-zinc-500">{event.planReason}</p>
      ) : null}

      {event.error ? (
        <p className="mt-2 text-[11px] text-red-300">{event.error}</p>
      ) : null}

      <footer className="mt-3 flex flex-wrap gap-2">
        {event.showConfirm && !readOnly ? (
          <button
            type="button"
            disabled={confirmBusy}
            onClick={() => void actions?.onConfirm?.()}
            className="inline-flex h-8 items-center rounded-lg bg-orange-500 px-3 text-xs font-medium text-white transition hover:bg-orange-400 disabled:opacity-50"
          >
            {confirmBusy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              "确认执行"
            )}
          </button>
        ) : null}
        {(event.showConfirm || event.showCancelActive) && !readOnly ? (
          <button
            type="button"
            disabled={confirmBusy}
            onClick={() => void actions?.onCancel?.()}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 px-3 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200 disabled:opacity-50"
          >
            <X className="size-3.5" />
            取消
          </button>
        ) : null}
      </footer>
    </article>
  );
}
