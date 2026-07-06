"use client";

import { useState } from "react";

import { VideoInpaintEditor } from "@/components/video-inpaint-editor";
import { canvasTheme } from "@/components/infinite-canvas/canvas-theme";
import { LightingOverlay, type LightSource } from "@/components/infinite-canvas/drama/LightingOverlay";
import { CameraOverlay, type CameraParams as DramaCameraParams } from "@/components/infinite-canvas/drama/CameraOverlay";
import type { CanvasNodeData } from "@/components/infinite-canvas/types";
import type { InfiniteNodeToolRequest } from "@/lib/infinite-node-tool-run";
import { resolveNodeImageUrl } from "@/lib/infinite-node-tool-run";

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
  onApplyLighting: (sources: LightSource[]) => void;
  showCamera: { node: CanvasNodeData } | null;
  onCloseCamera: () => void;
  onApplyCamera: (params: DramaCameraParams) => void;
};

export function InfiniteCanvasToolPanels({
  showVideoInpaint,
  onCloseVideoInpaint,
  videoInpaintSubmitting,
  onVideoInpaintSubmit,
  resolveVideoUrl,
  showLighting,
  onCloseLighting,
  onApplyLighting,
  showCamera,
  onCloseCamera,
  onApplyCamera,
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
          className="absolute right-3 top-20 z-30 w-[360px] rounded-xl border p-3 shadow-2xl"
          style={{
            background: canvasTheme.canvas.background,
            borderColor: canvasTheme.node.stroke,
          }}
          data-testid="lighting-inline-panel"
        >
          <div className="mb-2 flex items-center justify-between text-[11px]">
            <span className="font-semibold" style={{ color: canvasTheme.node.text }}>
              灯光控制
            </span>
            <button
              type="button"
              onClick={onCloseLighting}
              className="rounded p-0.5 text-[10px] hover:bg-white/10"
              style={{ color: canvasTheme.node.faint }}
              aria-label="关闭灯光控制"
            >
              关闭
            </button>
          </div>
          {resolveNodeImageUrl(showLighting.node) ? (
            <LightingOverlayInline
              imageUrl={resolveNodeImageUrl(showLighting.node)!}
              onApply={onApplyLighting}
              onClose={onCloseLighting}
            />
          ) : (
            <p className="text-[10px]" style={{ color: canvasTheme.node.faint }}>
              当前节点无可编辑图片
            </p>
          )}
        </div>
      ) : null}

      {showCamera ? (
        <div
          className="absolute right-3 top-20 z-30 w-[360px] rounded-xl border p-3 shadow-2xl"
          style={{
            background: canvasTheme.canvas.background,
            borderColor: canvasTheme.node.stroke,
          }}
          data-testid="camera-inline-panel"
        >
          <div className="mb-2 flex items-center justify-between text-[11px]">
            <span className="font-semibold" style={{ color: canvasTheme.node.text }}>
              摄像机控制
            </span>
            <button
              type="button"
              onClick={onCloseCamera}
              className="rounded p-0.5 text-[10px] hover:bg-white/10"
              style={{ color: canvasTheme.node.faint }}
              aria-label="关闭摄像机控制"
            >
              关闭
            </button>
          </div>
          <CameraOverlayInline
            node={showCamera.node}
            onApply={onApplyCamera}
            onClose={onCloseCamera}
          />
        </div>
      ) : null}
    </>
  );
}

function LightingOverlayInline({
  imageUrl,
  onApply,
  onClose,
}: {
  imageUrl: string;
  onApply: (sources: LightSource[]) => void;
  onClose: () => void;
}) {
  const [sources, setSources] = useState<LightSource[]>([]);
  return (
    <div className="flex flex-col gap-2">
      <LightingOverlay
        imageUrl={imageUrl}
        sources={sources}
        onSourcesChange={setSources}
        className="rounded-lg"
      />
      <div className="flex items-center justify-between text-[10px]">
        <span style={{ color: canvasTheme.node.faint }}>
          光源：{sources.length} 个
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setSources([])}
            className="rounded px-2 py-0.5 transition hover:bg-white/10"
            style={{ color: canvasTheme.node.muted }}
            disabled={sources.length === 0}
          >
            清空
          </button>
          <button
            type="button"
            onClick={() => onApply(sources)}
            className="rounded px-2 py-0.5 transition hover:bg-white/10"
            style={{ color: "#a5b4fc" }}
            disabled={sources.length === 0}
          >
            应用并重生成
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-0.5 transition hover:bg-white/10"
            style={{ color: canvasTheme.node.muted }}
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

function CameraOverlayInline({
  node,
  onApply,
  onClose,
}: {
  node: CanvasNodeData;
  onApply: (params: DramaCameraParams) => void;
  onClose: () => void;
}) {
  const m = node.metadata;
  const [params, setParams] = useState<DramaCameraParams>({
    shotSize: m?.cameraShotSize,
    movement: m?.cameraMovement,
    pitch: 0,
    yaw: 0,
  });
  const hasImage = Boolean(resolveNodeImageUrl(node));
  return (
    <div className="flex flex-col gap-2">
      <CameraOverlay params={params} onChange={setParams} />
      <div className="flex justify-end gap-1 text-[10px]">
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-0.5 transition hover:bg-white/10"
          style={{ color: canvasTheme.node.muted }}
        >
          关闭
        </button>
        <button
          type="button"
          onClick={() => onApply(params)}
          className="rounded px-2 py-0.5 transition hover:bg-white/10"
          style={{ color: "#a5b4fc" }}
        >
          {hasImage ? "应用并重生成" : "保存摄影参数"}
        </button>
      </div>
    </div>
  );
}
