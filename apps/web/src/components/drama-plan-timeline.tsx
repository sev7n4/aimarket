"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import type { DramaPlanStreamEvent } from "@/lib/drama-plan-stream";

export const DRAMA_PLAN_AGENT_META = [
  { id: "writer", label: "编剧" },
  { id: "director", label: "导演" },
  { id: "character", label: "角色" },
  { id: "cinematographer", label: "摄影" },
  { id: "storyboard", label: "分镜" },
] as const;

export type DramaPlanAgentKey = (typeof DRAMA_PLAN_AGENT_META)[number]["id"];

interface DramaPlanTimelineProps {
  prompt: string;
  currentAgent?: string | null;
  events: DramaPlanStreamEvent[];
  status?: "planning" | "completed" | "failed";
  error?: string | null;
  onRerunFromAgent?: (agent: string) => void;
  rerunBusy?: boolean;
}

function agentLabel(agent: string): string {
  return DRAMA_PLAN_AGENT_META.find((m) => m.id === agent)?.label ?? agent;
}

function agentDoneSummary(
  events: DramaPlanStreamEvent[],
  agent: string,
): string | undefined {
  const ev = [...events]
    .reverse()
    .find((e) => e.type === "agent_done" && e.agent === agent);
  return ev?.type === "agent_done" ? ev.summary : undefined;
}

function agentReasoning(
  events: DramaPlanStreamEvent[],
  agent: string,
): string | undefined {
  const chunks = events
    .filter((e) => e.type === "agent_reasoning" && e.agent === agent)
    .map((e) => (e.type === "agent_reasoning" ? e.chunk : ""));
  return chunks.length ? chunks.join("\n") : undefined;
}

export function buildDramaPlanEventFeed(
  events: DramaPlanStreamEvent[],
  status: "planning" | "completed" | "failed",
): { id: string; timeLabel: string; text: string }[] {
  const items: { id: string; timeLabel: string; text: string }[] = [];
  let seq = 0;

  for (const ev of events) {
    if (ev.type === "agent_start") {
      seq += 1;
      items.push({
        id: `start-${ev.agent}-${seq}`,
        timeLabel: `10:${String(seq).padStart(2, "0")}`,
        text: `${agentLabel(ev.agent)} 进行中…`,
      });
    } else if (ev.type === "agent_done") {
      seq += 1;
      const summary =
        ev.summary.length > 48 ? `${ev.summary.slice(0, 48)}…` : ev.summary;
      items.push({
        id: `done-${ev.agent}-${seq}`,
        timeLabel: `10:${String(seq).padStart(2, "0")}`,
        text: summary
          ? `${agentLabel(ev.agent)} 完成 — ${summary}`
          : `${agentLabel(ev.agent)} 完成`,
      });
    } else if (ev.type === "plan_failed") {
      seq += 1;
      items.push({
        id: `failed-${seq}`,
        timeLabel: `10:${String(seq).padStart(2, "0")}`,
        text: `规划失败 — ${ev.error}`,
      });
    }
  }

  if (status === "completed" && !events.some((e) => e.type === "plan_failed")) {
    seq += 1;
    items.push({
      id: "plan-complete",
      timeLabel: `10:${String(seq).padStart(2, "0")}`,
      text: "规划完成",
    });
  }

  return items;
}

function AgentPreview({
  agent,
  summary,
}: {
  agent: string;
  summary: string;
}) {
  if (!summary) return null;
  const tone =
    agent === "writer"
      ? "border-violet-500/25 bg-violet-500/5"
      : agent === "director"
        ? "border-amber-500/25 bg-amber-500/5"
        : agent === "character"
          ? "border-sky-500/25 bg-sky-500/5"
          : agent === "cinematographer"
            ? "border-emerald-500/25 bg-emerald-500/5"
            : "border-orange-500/25 bg-orange-500/5";

  return (
    <div
      className={`mt-1.5 rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed text-zinc-400 ${tone}`}
      data-testid={`drama-plan-preview-${agent}`}
    >
      {summary}
    </div>
  );
}

export function DramaPlanTimeline({
  prompt,
  currentAgent,
  events,
  status = "planning",
  error,
  onRerunFromAgent,
  rerunBusy,
}: DramaPlanTimelineProps) {
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(
    () => new Set(),
  );

  const doneAgents = new Set(
    events
      .filter((e) => e.type === "agent_done")
      .map((e) => (e.type === "agent_done" ? e.agent : "")),
  );

  const canRerun = status === "completed" || status === "failed";

  const eventFeed = useMemo(
    () => buildDramaPlanEventFeed(events, status),
    [events, status],
  );

  return (
    <article
      data-testid="drama-plan-timeline"
      className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] px-3 py-3 sm:px-4"
    >
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-medium text-violet-200">
          AI 短剧 · 多 Agent 规划
        </h3>
        <span className="text-[11px] text-zinc-500">
          {status === "planning"
            ? "规划进行中"
            : status === "failed"
              ? "规划失败"
              : "规划完成"}
        </span>
      </header>

      {prompt ? (
        <p className="mb-3 line-clamp-3 text-[12px] leading-relaxed text-zinc-500">
          {prompt}
        </p>
      ) : null}

      <nav
        className="mb-3 flex items-start gap-0 overflow-x-auto pb-1"
        data-testid="drama-plan-stepper"
        aria-label="规划进度"
      >
        {DRAMA_PLAN_AGENT_META.map((meta, i) => {
          const done = doneAgents.has(meta.id);
          const current = currentAgent === meta.id && !done;
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
                  aria-hidden
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
                  aria-hidden
                />
              ) : null}
            </div>
          );
        })}
      </nav>

      {eventFeed.length > 0 ? (
        <section className="mb-3 rounded-lg border border-white/5 bg-black/20 px-2.5 py-2">
          <h4 className="mb-1.5 text-[10px] font-medium text-zinc-500">
            事件流
          </h4>
          <ul
            className="space-y-1"
            data-testid="drama-plan-event-feed"
          >
            {eventFeed.map((item) => (
              <li
                key={item.id}
                className="flex gap-2 text-[10px] leading-relaxed text-zinc-500"
              >
                <span className="shrink-0 font-mono text-zinc-600">
                  {item.timeLabel}
                </span>
                <span className="min-w-0 text-zinc-400">{item.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ol className="space-y-2" data-testid="drama-plan-agent-steps">
        {DRAMA_PLAN_AGENT_META.map((meta, i) => {
          const done = doneAgents.has(meta.id);
          const current = currentAgent === meta.id && !done;
          const summary = agentDoneSummary(events, meta.id);
          const reasoning = agentReasoning(events, meta.id);
          const reasonOpen = expandedReasoning.has(meta.id);

          return (
            <li
              key={meta.id}
              data-testid={`drama-plan-agent-${meta.id}`}
              className={`rounded-lg border px-2.5 py-2 ${
                current
                  ? "border-orange-500/30 bg-orange-500/5"
                  : done
                    ? "border-white/5 bg-white/[0.02]"
                    : "border-transparent"
              }`}
            >
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                    current
                      ? "bg-orange-500/20 text-orange-200"
                      : done
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-white/10 text-zinc-500"
                  }`}
                >
                  {done ? (
                    <Check className="size-3" />
                  ) : current ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={
                    current
                      ? "font-medium text-orange-200"
                      : done
                        ? "text-zinc-300"
                        : "text-zinc-500"
                  }
                >
                  {meta.label}
                </span>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  {canRerun && done && onRerunFromAgent ? (
                    <button
                      type="button"
                      disabled={rerunBusy}
                      className="rounded border border-violet-500/30 px-1.5 py-0.5 text-[10px] text-violet-300 hover:bg-violet-500/10 disabled:opacity-50"
                      data-testid={`drama-plan-rerun-${meta.id}`}
                      onClick={() => onRerunFromAgent(meta.id)}
                    >
                      从此步重跑
                    </button>
                  ) : summary && done ? (
                    <span className="truncate text-[10px] text-zinc-600">
                      {summary}
                    </span>
                  ) : null}
                </div>
              </div>

              {done && summary ? (
                <AgentPreview agent={meta.id} summary={summary} />
              ) : null}

              {reasoning ? (
                <div className="mt-1.5">
                  <button
                    type="button"
                    className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400"
                    onClick={() =>
                      setExpandedReasoning((prev) => {
                        const next = new Set(prev);
                        if (next.has(meta.id)) next.delete(meta.id);
                        else next.add(meta.id);
                        return next;
                      })
                    }
                  >
                    {reasonOpen ? (
                      <ChevronDown className="size-3" />
                    ) : (
                      <ChevronRight className="size-3" />
                    )}
                    推理摘要
                  </button>
                  {reasonOpen ? (
                    <p className="mt-1 whitespace-pre-wrap text-[10px] leading-relaxed text-zinc-600">
                      {reasoning}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {error ? (
        <p className="mt-2 text-[10px] text-red-400/90">{error}</p>
      ) : null}
    </article>
  );
}
