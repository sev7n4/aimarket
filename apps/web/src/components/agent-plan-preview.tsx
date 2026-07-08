"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { AgentPlan } from "@/lib/types";
import { fetchAgentPlan } from "@/lib/api/agent";

interface AgentPlanPreviewProps {
  prompt: string;
  mode: string;
  enabled: boolean;
  onPlanChange?: (plan: AgentPlan | null) => void;
}

export function AgentPlanPreview({
  prompt,
  mode,
  enabled,
  onPlanChange,
}: AgentPlanPreviewProps) {
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPlan = useCallback(async () => {
    if (!enabled || !prompt.trim()) {
      setPlan(null);
      onPlanChange?.(null);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchAgentPlan({ prompt, mode });
      setPlan(data);
      onPlanChange?.(data);
    } catch {
      setPlan(null);
      onPlanChange?.(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, prompt, mode, onPlanChange]);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadPlan();
    }, 500);
    return () => clearTimeout(t);
  }, [loadPlan]);

  if (!enabled || !prompt.trim()) return null;

  if (loading && !plan) {
    return (
      <p className="flex items-center gap-2 text-xs text-zinc-500">
        <Loader2 className="size-3 animate-spin" />
        Agent 分析意图中…
      </p>
    );
  }

  if (!plan || plan.steps.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-zinc-300">Agent 执行计划</p>
        <p className="text-[10px] text-zinc-500">
          约 {plan.estimatedPoints} 积分
          {plan.requiresConfirm ? " · 提交前需确认" : ""}
        </p>
      </div>
      <ol className="mt-2 space-y-1">
        {plan.steps.map((step, i) => (
          <li
            key={`${step.type}-${step.label}-${i}`}
            className="flex items-center gap-2 text-xs text-zinc-400"
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] text-zinc-300">
              {i + 1}
            </span>
            <span>
              {step.type === "tool" ? "工具" : "生成"} · {step.label}
            </span>
          </li>
        ))}
      </ol>
      {plan.reason ? (
        <p className="mt-2 text-[10px] text-zinc-600">{plan.reason}</p>
      ) : null}
    </div>
  );
}
