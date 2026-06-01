"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import type { AgentPlan, AgentRun, AgentRunStatus } from "@/lib/types";
import { fetchAgentPlan } from "@/lib/api-client";

const STATUS_LABEL: Record<AgentRunStatus, string> = {
  planning: "规划中",
  waiting_confirm: "待确认",
  running: "执行中",
  waiting_job: "生成中",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

interface AgentRunPanelProps {
  prompt: string;
  mode: string;
  enabled: boolean;
  run: AgentRun | null;
  onPlanPreview?: (plan: AgentPlan | null) => void;
  onConfirm?: () => void;
  onCancelRun?: () => void;
  confirmBusy?: boolean;
}

export function AgentRunPanel({
  prompt,
  mode,
  enabled,
  run,
  onPlanPreview,
  onConfirm,
  onCancelRun,
  confirmBusy = false,
}: AgentRunPanelProps) {
  const [previewPlan, setPreviewPlan] = useState<AgentPlan | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPreview = useCallback(async () => {
    if (!enabled || !prompt.trim() || run) {
      setPreviewPlan(null);
      onPlanPreview?.(null);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchAgentPlan({ prompt, mode });
      setPreviewPlan(data);
      onPlanPreview?.(data);
    } catch {
      setPreviewPlan(null);
      onPlanPreview?.(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, prompt, mode, run, onPlanPreview]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadPreview();
    }, 500);
    return () => window.clearTimeout(t);
  }, [loadPreview]);

  if (!enabled || !prompt.trim()) return null;

  const plan = run?.plan ?? previewPlan;
  if (!plan && !loading && !run) return null;

  const currentIdx = run?.currentStepIndex ?? 0;
  const showConfirm = run?.status === "waiting_confirm";
  const activeRun = run && !TERMINAL.has(run.status);

  return (
    <div className="mb-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-zinc-300">
          {run ? "Agent 执行" : "Agent 执行计划"}
        </p>
        <div className="flex items-center gap-2">
          {run ? (
            <span className="text-[10px] text-zinc-500">
              {STATUS_LABEL[run.status]}
              {run.status === "running" || run.status === "waiting_job"
                ? ` · 步骤 ${Math.min(currentIdx + 1, plan?.steps.length ?? 0)}/${plan?.steps.length ?? 0}`
                : ""}
            </span>
          ) : null}
          {plan ? (
            <span className="text-[10px] text-zinc-500">
              约 {plan.estimatedPoints} 积分
              {plan.planSource ? ` · ${plan.planSource === "llm" ? "智能规划" : "规则规划"}` : ""}
            </span>
          ) : null}
        </div>
      </div>

      {loading && !plan ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
          <Loader2 className="size-3 animate-spin" />
          Agent 分析意图中…
        </p>
      ) : null}

      {plan && plan.steps.length > 0 ? (
        <ol className="mt-2 space-y-1">
          {plan.steps.map((step, i) => {
            const isCurrent =
              run &&
              (run.status === "running" || run.status === "waiting_job") &&
              i === currentIdx;
            const isDone = run && i < currentIdx;
            return (
              <li
                key={`${step.type}-${step.label}-${i}`}
                className={`flex items-center gap-2 text-xs ${
                  isCurrent ? "text-orange-300" : isDone ? "text-zinc-500" : "text-zinc-400"
                }`}
              >
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                    isCurrent
                      ? "bg-orange-500/20 text-orange-200"
                      : isDone
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-white/10 text-zinc-300"
                  }`}
                >
                  {isDone ? <Check className="size-3" /> : i + 1}
                </span>
                <span>
                  {step.type === "tool" ? "工具" : step.type === "video" ? "视频" : "生成"} ·{" "}
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {plan?.reason && !run ? (
        <p className="mt-2 text-[10px] text-zinc-600">{plan.reason}</p>
      ) : null}

      {run?.error ? (
        <p className="mt-2 text-[10px] text-red-400/90">{run.error}</p>
      ) : null}

      {!run && plan?.requiresConfirm ? (
        <p className="mt-2 text-[10px] text-amber-400/80">提交后将先展示计划并请求确认</p>
      ) : null}

      {showConfirm ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={confirmBusy}
            onClick={() => onConfirm?.()}
            className="rounded-lg bg-orange-500/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-500 disabled:opacity-50"
          >
            {confirmBusy ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" />
                确认中…
              </span>
            ) : (
              "确认执行"
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

      {activeRun && !showConfirm && onCancelRun ? (
        <button
          type="button"
          onClick={() => onCancelRun()}
          className="mt-2 inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300"
        >
          <X className="size-3" />
          取消 Agent 任务
        </button>
      ) : null}
    </div>
  );
}

const TERMINAL = new Set<AgentRunStatus>(["completed", "failed", "cancelled"]);
