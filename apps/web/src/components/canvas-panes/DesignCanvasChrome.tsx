"use client";

import type { ReactNode } from "react";
import { ArrowLeft, Columns2, MessageCircle, Network } from "lucide-react";

import type { DramaStudioViewPhase } from "@/lib/drama-studio-view";
import { toggleDramaStudioViewPhase } from "@/lib/drama-studio-view";
import { TOOL_DISPLAY_NAMES } from "@/lib/studio-tool-meta";

export type DesignCanvasChromeProps = {
  selectSourceBanner?: string | null;
  showFailureBannerDismiss?: boolean;
  onDismissJobFailure?: () => void;
  isRefineMode: boolean;
  onExitRefineMode: () => void;
  refineCompleteNotice: { count: number; toolName?: string } | null;
  compareAvailable: boolean;
  compareMode: boolean;
  onToggleCompareMode: () => void;
  canvasViewEnabled?: boolean;
  dramaViewPhase?: DramaStudioViewPhase;
  onDramaViewPhaseChange?: (phase: DramaStudioViewPhase) => void;
  focusClickActive: boolean;
  focusClickRequest: { toolName: string } | null;
  onFocusClickCancel?: () => void;
};

export function DesignCanvasChrome({
  selectSourceBanner,
  showFailureBannerDismiss,
  onDismissJobFailure,
  isRefineMode,
  onExitRefineMode,
  refineCompleteNotice,
  compareAvailable,
  compareMode,
  onToggleCompareMode,
  canvasViewEnabled,
  dramaViewPhase = "agent",
  onDramaViewPhaseChange,
  focusClickActive,
  focusClickRequest,
  onFocusClickCancel,
}: DesignCanvasChromeProps) {
  return (
    <>
      {selectSourceBanner ? (
        <div className="absolute left-2 right-2 top-2 z-20 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
          <span className="min-w-0 flex-1">{selectSourceBanner}</span>
          {showFailureBannerDismiss && onDismissJobFailure ? (
            <button
              type="button"
              onClick={onDismissJobFailure}
              className="shrink-0 rounded p-0.5 text-amber-200/70 transition hover:bg-amber-500/20 hover:text-amber-50"
              aria-label="关闭提示"
            >
              ×
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="absolute left-2 top-2 z-20 flex flex-wrap items-center gap-2">
        {isRefineMode ? (
          <button
            type="button"
            onClick={onExitRefineMode}
            className="flex items-center gap-1.5 rounded-lg bg-orange-500/20 px-3 py-1.5 text-xs text-orange-300 transition hover:bg-orange-500/30 hover:text-orange-100"
          >
            <ArrowLeft className="size-3.5" />
            <span>返回纵向模式</span>
          </button>
        ) : null}
        {isRefineMode && refineCompleteNotice ? (
          <div
            data-testid="refine-complete-notice"
            className="max-w-md rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100/90"
          >
            精修完成
            {refineCompleteNotice.toolName
              ? ` · ${TOOL_DISPLAY_NAMES[refineCompleteNotice.toolName] ?? refineCompleteNotice.toolName}`
              : ""}
            {refineCompleteNotice.count > 1
              ? ` · 共 ${refineCompleteNotice.count} 张，可在下方胶片切换`
              : " · 已切换到最新结果"}
          </div>
        ) : null}
        {isRefineMode && compareAvailable ? (
          <button
            type="button"
            data-testid="refine-compare-toggle"
            onClick={onToggleCompareMode}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition ${
              compareMode
                ? "bg-orange-500/25 text-orange-200"
                : "bg-white/10 text-zinc-300 hover:bg-white/15"
            }`}
          >
            <Columns2 className="size-3.5" />
            <span>{compareMode ? "退出对比" : "Before/After"}</span>
          </button>
        ) : null}
        {canvasViewEnabled && onDramaViewPhaseChange ? (
          <button
            type="button"
            data-testid="drama-view-phase-toggle"
            onClick={() =>
              onDramaViewPhaseChange(toggleDramaStudioViewPhase(dramaViewPhase))
            }
            className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-200 transition hover:bg-violet-500/20"
          >
            {dramaViewPhase === "agent" ? (
              <>
                <Network className="size-3.5" />
                <span>节点视图</span>
              </>
            ) : (
              <>
                <MessageCircle className="size-3.5" />
                <span>滚动视图</span>
              </>
            )}
          </button>
        ) : null}
      </div>

      {focusClickActive && focusClickRequest ? (
        <div
          data-testid="focus-edit-canvas-banner"
          className="absolute left-2 right-2 top-2 z-30 rounded-2xl border border-purple-400/30 bg-black/80 p-2 text-xs text-zinc-200 shadow-xl backdrop-blur"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-purple-200">
              {focusClickRequest.toolName}：点击图片添加焦点
            </span>
            <button
              type="button"
              onClick={onFocusClickCancel}
              className="ml-auto rounded-full bg-white/10 px-2.5 py-1 text-zinc-300"
            >
              完成点选
            </button>
          </div>
          <p className="mt-1 text-[10px] text-zinc-500">
            在工作站输入短 prompt
            后提交；最多 10 个焦点，连续点击间隔约 1.5 秒。
          </p>
        </div>
      ) : null}
    </>
  );
}
