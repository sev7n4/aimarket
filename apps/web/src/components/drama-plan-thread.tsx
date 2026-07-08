"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import { listDramaPlanTurns } from "@/lib/api/drama";
import type { DramaPlanTurn } from "@/lib/types";

interface DramaPlanThreadProps {
  sessionId?: string;
  /** 变化时重新拉取（如规划完成、切换草稿） */
  refreshKey?: string | number;
}

function formatTime(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 多轮对话策划线程：展示初稿与每次迭代指令，形成时间线 */
export function DramaPlanThread({ sessionId, refreshKey }: DramaPlanThreadProps) {
  const [turns, setTurns] = useState<DramaPlanTurn[]>([]);

  useEffect(() => {
    if (!sessionId) {
      setTurns([]);
      return;
    }
    let cancelled = false;
    listDramaPlanTurns(sessionId)
      .then((data) => {
        if (!cancelled) setTurns(data);
      })
      .catch(() => {
        if (!cancelled) setTurns([]);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, refreshKey]);

  if (turns.length === 0) return null;

  return (
    <div
      className="mb-3 rounded-lg border border-white/5 bg-black/20 p-2"
      data-testid="drama-plan-thread"
    >
      <div className="mb-1.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        <MessageCircle className="size-3" />
        对话历史 · {turns.length} 轮
      </div>
      <ol className="space-y-1.5">
        {turns.map((turn, i) => {
          const isRefine = turn.kind === "refine";
          return (
            <li
              key={turn.id}
              className="flex items-start gap-2 text-xs"
              data-testid="drama-plan-turn"
            >
              <span
                className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold ${
                  isRefine
                    ? "bg-violet-500/20 text-violet-200"
                    : "bg-emerald-500/20 text-emerald-200"
                }`}
              >
                {isRefine ? <Sparkles className="size-2.5" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-1 py-px text-[9px] ${
                      isRefine
                        ? "bg-violet-500/10 text-violet-300"
                        : "bg-emerald-500/10 text-emerald-300"
                    }`}
                  >
                    {isRefine ? "迭代" : "初稿"}
                  </span>
                  {turn.createdAt ? (
                    <span className="text-[9px] text-zinc-600">
                      {formatTime(turn.createdAt)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-zinc-300">
                  {turn.instruction}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
