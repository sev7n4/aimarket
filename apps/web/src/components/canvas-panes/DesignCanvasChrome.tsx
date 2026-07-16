"use client";

export type DesignCanvasChromeProps = {
  selectSourceBanner?: string | null;
  showFailureBannerDismiss?: boolean;
  onDismissJobFailure?: () => void;
  focusClickActive: boolean;
  focusClickRequest: { toolName: string } | null;
  onFocusClickCancel?: () => void;
};

export function DesignCanvasChrome({
  selectSourceBanner,
  showFailureBannerDismiss,
  onDismissJobFailure,
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
