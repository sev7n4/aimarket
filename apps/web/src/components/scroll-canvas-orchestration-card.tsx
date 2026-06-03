"use client";

import { Check, Loader2 } from "lucide-react";
import type { OrchestrationTimelineEvent } from "@/lib/canvas-timeline";

const STATUS_LABEL: Record<string, string> = {
  preview: "计划预览",
  planning: "规划中",
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
}

export function ScrollCanvasOrchestrationCard({
  event,
}: ScrollCanvasOrchestrationCardProps) {
  const statusLabel = STATUS_LABEL[event.status] ?? event.status;

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

      {event.steps.length > 0 ? (
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
                · {step.label}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {event.estimatedPoints != null ? (
        <p className="mt-2 text-[10px] text-zinc-600">
          约 {event.estimatedPoints} 积分
          {event.showConfirm && event.status === "preview"
            ? " · 提交后将请求确认"
            : ""}
        </p>
      ) : null}

      {event.error ? (
        <p className="mt-2 text-[10px] text-red-400/90">{event.error}</p>
      ) : null}
    </article>
  );
}
