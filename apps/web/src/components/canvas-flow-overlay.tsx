"use client";

import {
  Workflow,
  ListTree,
  LayoutGrid,
  Terminal,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useStudioOrchestrationOptional } from "@/components/studio-orchestration-provider";
import type { OrchestrationTimelineEvent } from "@/lib/canvas-timeline";

interface CanvasFlowOverlayProps {
  onToggleCanvas: () => void;
  onAutoLayout?: () => void;
  onOpenCommandPalette?: () => void;
}

/** 节点画布模式下的浮动覆盖层：编排时间线 + 画布切换 + 工具栏 */
export function CanvasFlowOverlay({
  onToggleCanvas,
  onAutoLayout,
  onOpenCommandPalette,
}: CanvasFlowOverlayProps) {
  const ctx = useStudioOrchestrationOptional();

  const timeline = ctx?.timelineEvent ?? null;
  const actions = ctx?.timelineActions ?? null;

  return (
    <>
      {/* 右上角：工具栏组 */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
        {onOpenCommandPalette ? (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0f0f0f]/90 px-2.5 py-1.5 text-[11px] text-zinc-400 backdrop-blur hover:border-indigo-500/40 hover:text-indigo-300 transition-colors"
            title="打开命令面板（/）"
          >
            <Terminal className="size-3.5" />
            <span>
              <kbd className="rounded bg-white/5 px-1 text-[10px]">/</kbd>{" "}
              命令
            </span>
          </button>
        ) : null}
        {onAutoLayout ? (
          <button
            type="button"
            onClick={onAutoLayout}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0f0f0f]/90 px-2.5 py-1.5 text-[11px] text-zinc-400 backdrop-blur hover:border-indigo-500/40 hover:text-indigo-300 transition-colors"
            title="一键整理节点布局"
          >
            <LayoutGrid className="size-3.5" />
            一键整理
          </button>
        ) : null}
        <button
          type="button"
          onClick={onToggleCanvas}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0f0f0f]/90 px-2.5 py-1.5 text-[11px] text-zinc-400 backdrop-blur hover:border-indigo-500/40 hover:text-indigo-300 transition-colors"
          title="切换到列表画布"
        >
          <ListTree className="size-3.5" />
          列表视图
        </button>
      </div>

      {/* 顶部中央：编排时间线 */}
      {timeline ? (
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2">
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#0f0f0f]/95 px-3.5 py-2 shadow-xl backdrop-blur">
            <TimelineStatusIcon status={timeline.status} runType={timeline.runType} />

            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium text-zinc-200">
                {timeline.title}
              </span>
              {timeline.error ? (
                <span className="text-[9px] text-red-400 line-clamp-1">{timeline.error}</span>
              ) : null}
            </div>

            {/* 步骤进度（agent/skill） */}
            {timeline.steps && timeline.steps.length > 0 ? (
              <div className="ml-2 flex items-center gap-1">
                {timeline.steps.map((step, i) => (
                  <div
                    key={i}
                    className={`size-1.5 rounded-full ${
                      step.done
                        ? "bg-emerald-500"
                        : step.current
                          ? "bg-indigo-400 animate-pulse"
                          : "bg-zinc-700"
                    }`}
                    title={step.label}
                  />
                ))}
              </div>
            ) : null}

            {/* 操作按钮 */}
            {actions ? (
              <div className="ml-2 flex items-center gap-1.5">
                {timeline.status === "waiting_confirm" && actions.onConfirm ? (
                  <button
                    type="button"
                    onClick={() => actions.onConfirm?.()}
                    disabled={actions.confirmBusy}
                    className="rounded-md bg-indigo-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {actions.confirmBusy ? "确认中..." : "确认执行"}
                  </button>
                ) : null}
                {(timeline.status === "running" || timeline.status === "planning") && actions.onCancel ? (
                  <button
                    type="button"
                    onClick={() => actions.onCancel?.()}
                    className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:border-red-500/40 hover:text-red-400"
                  >
                    取消
                  </button>
                ) : null}
                {timeline.status === "failed" && actions.onRerunFromAgent ? (
                  <button
                    type="button"
                    onClick={() => actions.onRerunFromAgent?.(timeline.runType === "agent" ? "agent" : "")}
                    className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:border-amber-500/40 hover:text-amber-400"
                  >
                    重试
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

/** 时间线状态图标 */
function TimelineStatusIcon({
  status,
  runType,
}: {
  status: OrchestrationTimelineEvent["status"];
  runType: OrchestrationTimelineEvent["runType"];
}) {
  if (status === "completed") {
    return <CheckCircle2 className="size-4 text-emerald-400" />;
  }
  if (status === "failed") {
    return <XCircle className="size-4 text-red-400" />;
  }
  if (status === "cancelled") {
    return <XCircle className="size-4 text-zinc-500" />;
  }
  if (runType === "drama_plan" && status === "planning") {
    return <Workflow className="size-4 text-violet-400" />;
  }
  return <Loader2 className="size-4 animate-spin text-indigo-400" />;
}
