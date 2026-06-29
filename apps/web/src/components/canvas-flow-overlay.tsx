"use client";

import {
  useEffect,
  useState,
  type RefObject,
} from "react";
import {
  Workflow,
  ListTree,
  LayoutGrid,
  Terminal,
  Loader2,
  CheckCircle2,
  XCircle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Undo2,
  Redo2,
  Copy,
} from "lucide-react";
import { useStudioOrchestrationOptional } from "@/components/studio-orchestration-provider";
import type { OrchestrationTimelineEvent } from "@/lib/canvas-timeline";
import type { CanvasFlowHandle } from "@/components/canvas-flow";

interface CanvasFlowOverlayProps {
  onToggleCanvas: () => void;
  onAutoLayout?: () => void;
  onOpenCommandPalette?: () => void;
  /** P4.1: 画布 ref，用于缩放/适配/实时缩放订阅 */
  canvasRef?: RefObject<CanvasFlowHandle | null>;
}

/** 节点画布模式下的浮动覆盖层：编排时间线 + 画布切换 + 工具栏 */
export function CanvasFlowOverlay({
  onToggleCanvas,
  onAutoLayout,
  onOpenCommandPalette,
  canvasRef,
}: CanvasFlowOverlayProps) {
  const ctx = useStudioOrchestrationOptional();

  const timeline = ctx?.timelineEvent ?? null;
  const actions = ctx?.timelineActions ?? null;

  /** P4.1: 实时缩放百分比（订阅 CanvasFlow 的 onMove） */
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    if (!canvasRef?.current?.subscribeZoom) return;
    return canvasRef.current.subscribeZoom(setZoom);
  }, [canvasRef]);

  /** P4.2: 撤销/重做可用性（订阅 history） */
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  useEffect(() => {
    if (!canvasRef?.current?.subscribeHistory) return;
    return canvasRef.current.subscribeHistory(setHistoryState);
  }, [canvasRef]);

  const zoomPercent = Math.round(zoom * 100);
  const handleZoomIn = () => canvasRef?.current?.zoomBy(1);
  const handleZoomOut = () => canvasRef?.current?.zoomBy(-1);
  const handleFit = () => canvasRef?.current?.fitView();
  const handleUndo = () => canvasRef?.current?.undo();
  const handleRedo = () => canvasRef?.current?.redo();
  const handleCopy = () => canvasRef?.current?.copy();

  return (
    <>
      {/* 右上角：工具栏组 */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
        {canvasRef ? (
          <div
            data-testid="canvas-history-controls"
            className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-[#0f0f0f]/90 p-0.5 backdrop-blur"
            title="撤销/重做（Ctrl+Z / Ctrl+Shift+Z）"
          >
            <button
              type="button"
              onClick={handleUndo}
              disabled={!historyState.canUndo}
              className="flex size-7 items-center justify-center rounded text-zinc-400 hover:bg-white/5 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
              title="撤销（Ctrl+Z）"
            >
              <Undo2 className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!historyState.canRedo}
              className="flex size-7 items-center justify-center rounded text-zinc-400 hover:bg-white/5 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
              title="重做（Ctrl+Shift+Z）"
            >
              <Redo2 className="size-3.5" />
            </button>
            <div className="mx-0.5 h-4 w-px bg-white/10" />
            <button
              type="button"
              onClick={handleCopy}
              className="flex size-7 items-center justify-center rounded text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              title="复制选中节点（Ctrl+C）"
            >
              <Copy className="size-3.5" />
            </button>
          </div>
        ) : null}
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

      {/* P4.1: 左下角：缩放控制 + 实时百分比 */}
      {canvasRef ? (
        <div
          data-testid="canvas-zoom-controls"
          className="absolute bottom-3 left-3 z-20 flex items-center gap-1 rounded-lg border border-white/10 bg-[#0f0f0f]/90 p-1 backdrop-blur"
          title="缩放控制（也可按住 Space + 滚轮）"
        >
          <button
            type="button"
            onClick={handleZoomOut}
            className="flex size-7 items-center justify-center rounded text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            title="缩小（-）"
          >
            <ZoomOut className="size-3.5" />
          </button>
          <div className="min-w-[44px] text-center text-[10px] font-mono text-zinc-500">
            {zoomPercent}%
          </div>
          <button
            type="button"
            onClick={handleZoomIn}
            className="flex size-7 items-center justify-center rounded text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            title="放大（+）"
          >
            <ZoomIn className="size-3.5" />
          </button>
          <div className="mx-0.5 h-4 w-px bg-white/10" />
          <button
            type="button"
            onClick={handleFit}
            className="flex size-7 items-center justify-center rounded text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            title="适配视图（0）"
          >
            <Maximize2 className="size-3.5" />
          </button>
        </div>
      ) : null}

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
