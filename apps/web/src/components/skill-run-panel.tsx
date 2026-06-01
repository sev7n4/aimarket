"use client";

import { Check, Loader2, X } from "lucide-react";
import type { AgentSkillPublic, SkillRun, SkillRunStatus } from "@/lib/types";

const STATUS_LABEL: Record<SkillRunStatus, string> = {
  queued: "排队中",
  waiting_confirm: "待确认",
  running: "执行中",
  waiting_job: "生成中",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

interface SkillRunPanelProps {
  skill: AgentSkillPublic | null;
  run: SkillRun | null;
  onConfirm?: () => void;
  onCancelRun?: () => void;
  confirmBusy?: boolean;
}

export function SkillRunPanel({
  skill,
  run,
  onConfirm,
  onCancelRun,
  confirmBusy = false,
}: SkillRunPanelProps) {
  if (!skill && !run) return null;

  const steps = run?.steps ?? [];
  const showConfirm = run?.status === "waiting_confirm";
  const activeRun =
    run && !TERMINAL.has(run.status) && run.status !== "waiting_confirm";

  const title = run?.skillName ?? skill?.name ?? "套餐";
  const estimated = run?.estimatedPoints;
  const confirmOver = run?.confirmIfPointsOver ?? skill?.confirmIfPointsOver;

  return (
    <div className="mb-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-amber-100/90">套餐 · {title}</p>
        <div className="flex items-center gap-2">
          {run ? (
            <span className="text-[10px] text-zinc-500">
              {STATUS_LABEL[run.status]}
              {(run.status === "running" || run.status === "waiting_job") &&
              steps.length > 0
                ? ` · 步骤 ${Math.min(run.currentStepIndex + 1, steps.length)}/${steps.length}`
                : ""}
            </span>
          ) : null}
          {estimated != null ? (
            <span className="text-[10px] text-zinc-500">约 {estimated} 积分</span>
          ) : confirmOver != null ? (
            <span className="text-[10px] text-zinc-500">
              超过 {confirmOver} 积分需确认
            </span>
          ) : null}
        </div>
      </div>

      {(run?.description ?? skill?.description) ? (
        <p className="mt-1 text-[10px] text-zinc-500">
          {run?.description ?? skill?.description}
        </p>
      ) : null}

      {steps.length > 0 ? (
        <ol className="mt-2 space-y-1">
          {steps.map((step) => {
            const isCurrent = step.current;
            const isDone = step.done;
            return (
              <li
                key={step.id}
                className={`flex items-center gap-2 text-xs ${
                  isCurrent ? "text-amber-300" : isDone ? "text-zinc-500" : "text-zinc-400"
                }`}
              >
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                    isCurrent
                      ? "bg-amber-500/20 text-amber-200"
                      : isDone
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-white/10 text-zinc-300"
                  }`}
                >
                  {isDone ? <Check className="size-3" /> : step.index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span>{step.label}</span>
                  {step.type === "generate_set" &&
                  step.outputs?.heroOutputIndex !== undefined &&
                  isDone ? (
                    <span className="ml-1.5 text-[10px] text-zinc-600">
                      主图：第 {step.outputs.heroOutputIndex + 1} 张
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      ) : skill && skill.stepCount > 0 && !run ? (
        <p className="mt-2 text-[10px] text-zinc-500">共 {skill.stepCount} 步流水线</p>
      ) : null}

      {run?.error ? (
        <p className="mt-2 text-[10px] text-red-400/90">{run.error}</p>
      ) : null}

      {showConfirm ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={confirmBusy}
            onClick={() => onConfirm?.()}
            className="rounded-lg bg-amber-500/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {confirmBusy ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" />
                确认中…
              </span>
            ) : (
              "确认执行套餐"
            )}
          </button>
          <button
            type="button"
            disabled={confirmBusy}
            onClick={() => onCancelRun?.()}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/5"
          >
            取消
          </button>
        </div>
      ) : null}

      {activeRun && onCancelRun ? (
        <button
          type="button"
          onClick={() => onCancelRun()}
          className="mt-2 inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300"
        >
          <X className="size-3" />
          取消套餐任务
        </button>
      ) : null}
    </div>
  );
}

const TERMINAL = new Set<SkillRunStatus>(["completed", "failed", "cancelled"]);
