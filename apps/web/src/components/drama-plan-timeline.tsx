"use client";

import { useState } from "react";
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
}: DramaPlanTimelineProps) {
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(
    () => new Set(),
  );

  const doneAgents = new Set(
    events
      .filter((e) => e.type === "agent_done")
      .map((e) => (e.type === "agent_done" ? e.agent : "")),
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
                {summary && done ? (
                  <span className="ml-auto truncate text-[10px] text-zinc-600">
                    {summary}
                  </span>
                ) : null}
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
