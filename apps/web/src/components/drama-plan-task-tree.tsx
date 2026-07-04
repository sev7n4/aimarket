"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import type { DramaPlanStreamEvent } from "@/lib/drama-plan-stream";
import type { DramaPlanAgentKey } from "@/components/drama-plan-timeline";

/** Seko 式一级任务 + 二级子步（工具步在 P1 接真实 tool 事件） */
const TASK_TREE: {
  agent: DramaPlanAgentKey;
  label: string;
  subSteps?: { id: string; label: string; tool?: boolean }[];
}[] = [
  {
    agent: "writer",
    label: "将创意扩展为完整剧本",
    subSteps: [{ id: "writer-script", label: "撰写场次与对白" }],
  },
  {
    agent: "director",
    label: "确定视觉基调与美术风格",
    subSteps: [{ id: "director-style", label: "定义 style bible" }],
  },
  {
    agent: "character",
    label: "设计角色与主体形象",
    subSteps: [
      { id: "char-features", label: "设计角色特征" },
      { id: "char-gen", label: "调用工具生成角色图", tool: true },
    ],
  },
  {
    agent: "cinematographer",
    label: "设计镜头摄影方案",
    subSteps: [{ id: "cam-spec", label: "运镜与构图规范" }],
  },
  {
    agent: "storyboard",
    label: "生成剧情分镜表",
    subSteps: [{ id: "sb-table", label: "分镜字段与时长" }],
  },
];

function doneAgents(events: DramaPlanStreamEvent[]): Set<string> {
  return new Set(
    events
      .filter((e) => e.type === "agent_done")
      .map((e) => (e.type === "agent_done" ? e.agent : "")),
  );
}

interface DramaPlanTaskTreeProps {
  events: DramaPlanStreamEvent[];
  currentAgent?: string | null;
  status?: "planning" | "completed" | "failed";
}

export function DramaPlanTaskTree({
  events,
  currentAgent,
  status = "planning",
}: DramaPlanTaskTreeProps) {
  const completed = useMemo(() => doneAgents(events), [events]);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(TASK_TREE.map((t) => t.agent)),
  );

  return (
    <ol
      className="space-y-1.5"
      data-testid="drama-plan-agent-steps"
      aria-label="规划任务链"
    >
      {TASK_TREE.map((task) => {
        const done = completed.has(task.agent);
        const current = currentAgent === task.agent && !done && status === "planning";
        const open = expanded.has(task.agent);
        const hasSubs = (task.subSteps?.length ?? 0) > 0;

        return (
          <li
            key={task.agent}
            data-testid={`drama-plan-agent-${task.agent}`}
            className={`rounded-lg border px-2.5 py-2 ${
              current
                ? "border-orange-500/30 bg-orange-500/5"
                : done
                  ? "border-white/5 bg-white/[0.02]"
                  : "border-transparent"
            }`}
          >
            <div className="flex items-start gap-2">
              {hasSubs ? (
                <button
                  type="button"
                  className="mt-0.5 shrink-0 text-zinc-500 hover:text-zinc-300"
                  aria-expanded={open}
                  onClick={() =>
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(task.agent)) next.delete(task.agent);
                      else next.add(task.agent);
                      return next;
                    })
                  }
                >
                  {open ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronRight className="size-3.5" />
                  )}
                </button>
              ) : (
                <span className="mt-0.5 size-3.5 shrink-0" />
              )}
              <span
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
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
                ) : null}
              </span>
              <span
                className={`min-w-0 flex-1 text-xs leading-snug ${
                  current
                    ? "font-medium text-orange-200"
                    : done
                      ? "text-zinc-300"
                      : "text-zinc-500"
                }`}
              >
                {task.label}
              </span>
            </div>

            {hasSubs && open ? (
              <ul className="ml-9 mt-2 space-y-1 border-l border-white/10 pl-3">
                {task.subSteps!.map((sub) => (
                  <li
                    key={sub.id}
                    className="flex items-center gap-2 text-[10px] text-zinc-500"
                  >
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${
                        done
                          ? "bg-emerald-500/80"
                          : current
                            ? "bg-orange-400/80"
                            : "bg-white/20"
                      }`}
                    />
                    <span className={sub.tool ? "text-violet-300/80" : undefined}>
                      {sub.label}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
