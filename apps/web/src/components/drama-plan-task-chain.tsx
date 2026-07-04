"use client";

import { DramaPlanThread } from "@/components/drama-plan-thread";
import { DramaPlanTaskTree } from "@/components/drama-plan-task-tree";
import { DRAMA_PLAN_AGENT_META } from "@/components/drama-plan-timeline";
import type { DramaPlanStreamEvent } from "@/lib/drama-plan-stream";

interface DramaPlanTaskChainProps {
  sessionId?: string;
  prompt: string;
  currentAgent?: string | null;
  events: DramaPlanStreamEvent[];
  status?: "planning" | "completed" | "failed";
  error?: string | null;
  refreshKey?: string | number;
  onRerunFromAgent?: (agent: string) => void;
  rerunBusy?: boolean;
}

/** 左侧：对话线程 + 分层 Agent 任务链（Seko 式） */
export function DramaPlanTaskChain({
  sessionId,
  prompt,
  currentAgent,
  events,
  status = "planning",
  error,
  refreshKey,
  onRerunFromAgent,
  rerunBusy,
}: DramaPlanTaskChainProps) {
  return (
    <div
      data-testid="drama-plan-task-chain"
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      <header className="shrink-0 border-b border-white/5 px-3 py-3 sm:px-4">
        <h2 className="text-[13px] font-medium text-violet-200">Agent 任务链</h2>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          {status === "planning"
            ? "多 Agent 协同规划中"
            : status === "failed"
              ? "规划失败"
              : "规划完成"}
        </p>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4"
        data-testid="drama-plan-timeline"
      >
        {sessionId ? (
          <DramaPlanThread sessionId={sessionId} refreshKey={refreshKey} />
        ) : null}

        {prompt ? (
          <div
            className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2"
            data-testid="drama-plan-user-prompt"
          >
            <p className="text-[10px] font-medium text-emerald-300/80">创意</p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-zinc-300">
              {prompt}
            </p>
          </div>
        ) : null}

        <nav
          className="mb-3 flex items-start gap-0 overflow-x-auto pb-1"
          data-testid="drama-plan-stepper"
          aria-label="规划进度"
        >
          {DRAMA_PLAN_AGENT_META.map((meta, i) => {
            const done = events.some(
              (e) => e.type === "agent_done" && e.agent === meta.id,
            );
            const current =
              currentAgent === meta.id && !done && status === "planning";
            return (
              <div key={meta.id} className="flex min-w-0 flex-1 items-center">
                <div
                  className="flex flex-col items-center gap-1"
                  data-testid={`drama-plan-step-${meta.id}`}
                >
                  <span
                    className={`flex size-3 shrink-0 items-center justify-center rounded-full ${
                      current
                        ? "bg-orange-500 ring-2 ring-orange-500/30"
                        : done
                          ? "bg-emerald-500"
                          : "bg-white/15"
                    }`}
                  />
                  <span
                    className={`max-w-[3.5rem] truncate text-center text-[9px] leading-tight ${
                      current
                        ? "font-medium text-orange-200"
                        : done
                          ? "text-emerald-300/90"
                          : "text-zinc-600"
                    }`}
                  >
                    {meta.label}
                  </span>
                </div>
                {i < DRAMA_PLAN_AGENT_META.length - 1 ? (
                  <div
                    className={`mx-0.5 mt-1.5 h-px min-w-2 flex-1 ${
                      done ? "bg-emerald-500/40" : "bg-white/10"
                    }`}
                  />
                ) : null}
              </div>
            );
          })}
        </nav>

        <DramaPlanTaskTree
          events={events}
          currentAgent={currentAgent}
          status={status}
        />

        {error ? (
          <p className="mt-2 text-[10px] text-red-400/90">{error}</p>
        ) : null}

        {onRerunFromAgent &&
        (status === "completed" || status === "failed") ? (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/5 pt-2">
            {DRAMA_PLAN_AGENT_META.filter((m) =>
              events.some((e) => e.type === "agent_done" && e.agent === m.id),
            ).map((meta) => (
              <button
                key={meta.id}
                type="button"
                disabled={rerunBusy}
                data-testid={`drama-plan-rerun-${meta.id}`}
                className="rounded border border-violet-500/30 px-2 py-0.5 text-[10px] text-violet-300 hover:bg-violet-500/10 disabled:opacity-50"
                onClick={() => onRerunFromAgent(meta.id)}
              >
                从{meta.label}重跑
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
