"use client";

import { VideoInpaintEditor } from "@/components/video-inpaint-editor";
import { canvasTheme } from "@/components/infinite-canvas/canvas-theme";
import type { CanvasNodeData } from "@/components/infinite-canvas/types";

export type InfiniteCanvasToolPanelsProps = {
  showVideoInpaint: { node: CanvasNodeData } | null;
  onCloseVideoInpaint: () => void;
  videoInpaintSubmitting: boolean;
  onVideoInpaintSubmit: (payload: {
    prompt: string;
    timestampSec?: number;
    maskDataUrl: string;
    maskBbox?: { x: number; y: number; width: number; height: number };
    maskNormalizedBbox?: { x: number; y: number; width: number; height: number };
  }) => void;
  resolveVideoUrl: (node: CanvasNodeData) => string | undefined;
  showLighting: { node: CanvasNodeData } | null;
  onCloseLighting: () => void;
  showCamera: { node: CanvasNodeData } | null;
  onCloseCamera: () => void;
};

export function InfiniteCanvasToolPanels({
  showVideoInpaint,
  onCloseVideoInpaint,
  videoInpaintSubmitting,
  onVideoInpaintSubmit,
  resolveVideoUrl,
  showLighting,
  onCloseLighting,
  showCamera,
  onCloseCamera,
}: InfiniteCanvasToolPanelsProps) {
  return (
    <>
      {showVideoInpaint ? (
        <div
          className="absolute right-3 top-20 z-30 w-[420px] rounded-xl border p-3 shadow-2xl"
          style={{
            background: canvasTheme.canvas.background,
            borderColor: canvasTheme.node.stroke,
          }}
          data-testid="video-inpaint-inline-panel"
        >
          <div className="mb-2 flex items-center justify-between text-[11px]">
            <span className="font-semibold" style={{ color: canvasTheme.node.text }}>
              视频精准编辑
            </span>
            <button
              type="button"
              onClick={onCloseVideoInpaint}
              className="rounded p-0.5 text-[10px] hover:bg-white/10"
              style={{ color: canvasTheme.node.faint }}
              aria-label="关闭视频精准编辑"
            >
              关闭
            </button>
          </div>
          <VideoInpaintEditor
            videoUrl={resolveVideoUrl(showVideoInpaint.node)}
            submitting={videoInpaintSubmitting}
            onSubmit={onVideoInpaintSubmit}
          />
        </div>
      ) : null}

      {showLighting ? (
        <div
          className="absolute right-3 top-20 z-30 rounded-xl border px-3 py-2 text-[10px] shadow-2xl"
          style={{
            background: canvasTheme.canvas.background,
            borderColor: canvasTheme.node.stroke,
            color: canvasTheme.node.faint,
          }}
        >
          灯光控制已随短剧产品线下线
          <button type="button" className="ml-2 underline" onClick={onCloseLighting}>
            关闭
          </button>
        </div>
      ) : null}

      {showCamera ? (
        <div
          className="absolute right-3 top-20 z-30 rounded-xl border px-3 py-2 text-[10px] shadow-2xl"
          style={{
            background: canvasTheme.canvas.background,
            borderColor: canvasTheme.node.stroke,
            color: canvasTheme.node.faint,
          }}
        >
          摄像机控制已随短剧产品线下线
          <button type="button" className="ml-2 underline" onClick={onCloseCamera}>
            关闭
          </button>
        </div>
      ) : null}
    </>
  );
}
