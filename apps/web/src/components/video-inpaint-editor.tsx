"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@aimarket/ui";
import { Eraser, Loader2, Pencil, RotateCcw, Upload } from "lucide-react";
import {
  useMaskBrush,
  type MaskPoint,
} from "@/hooks/use-mask-brush";
import type { CanvasMaskSelection } from "@/lib/canvas-tools";

export interface VideoInpaintSubmitPayload {
  videoUrl: string;
  maskDataUrl: string;
  maskBbox: CanvasMaskSelection["bbox"];
  maskNormalizedBbox: CanvasMaskSelection["normalizedBbox"];
  prompt: string;
  timestampSec?: number;
}

interface VideoInpaintEditorProps {
  videoUrl?: string;
  onSubmit: (payload: VideoInpaintSubmitPayload) => void;
  submitting?: boolean;
}

/**
 * 视频精准编辑面板（简化方案）
 * - 上传/选择视频 → 在首帧截图上绘制 mask → 输入编辑 prompt → 提交
 */
export function VideoInpaintEditor({
  videoUrl: initialVideoUrl,
  onSubmit,
  submitting = false,
}: VideoInpaintEditorProps) {
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl ?? "");
  const [frameDataUrl, setFrameDataUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [timestampSec, setTimestampSec] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);

  const [frameWidth, setFrameWidth] = useState(720);
  const [frameHeight, setFrameHeight] = useState(480);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);

  const maskBrush = useMaskBrush(frameWidth, frameHeight);

  /** 从文件选择上传视频 */
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setFrameDataUrl(null);
    },
    [],
  );

  /** 视频加载完成 → 截取首帧 */
  const handleVideoLoaded = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setFrameWidth(video.videoWidth || 720);
    setFrameHeight(video.videoHeight || 480);

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setFrameDataUrl(canvas.toDataURL("image/jpeg", 0.9));
    }
  }, []);

  /** mask canvas 鼠标事件 */
  const getCanvasPoint = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): MaskPoint => {
      const canvas = maskCanvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = frameWidth / rect.width;
      const scaleY = frameHeight / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    [frameWidth, frameHeight],
  );

  const handlePointerDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!maskBrush.hasMask) maskBrush.pushHistory();
      setIsDrawing(true);
      const point = getCanvasPoint(e);
      maskBrush.appendStrokePoint(point);
    },
    [maskBrush, getCanvasPoint],
  );

  const handlePointerMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      const point = getCanvasPoint(e);
      const lastStroke = maskBrush.maskStrokes[maskBrush.maskStrokes.length - 1];
      if (lastStroke) {
        maskBrush.updateActiveStroke([...lastStroke, point]);
      }
    },
    [isDrawing, maskBrush, getCanvasPoint],
  );

  const handlePointerUp = useCallback(() => {
    setIsDrawing(false);
  }, []);

  /** 在 mask overlay canvas 上绘制当前 mask */
  const drawMaskOverlay = useCallback(() => {
    const overlay = maskCanvasRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, frameWidth, frameHeight);
    ctx.fillStyle = "rgba(255, 80, 80, 0.35)";
    ctx.strokeStyle = "rgba(255, 80, 80, 0.6)";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = maskBrush.brushSize;

    for (const stroke of maskBrush.maskStrokes) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (const pt of stroke.slice(1)) ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
    }
    for (const box of maskBrush.maskBoxes) {
      ctx.fillRect(box.x, box.y, box.width, box.height);
      ctx.strokeRect(box.x, box.y, box.width, box.height);
    }
  }, [maskBrush.maskStrokes, maskBrush.maskBoxes, maskBrush.brushSize, frameWidth, frameHeight]);

  // mask 数据变化时重绘 overlay
  const prevStrokesLen = useRef(0);
  const prevBoxesLen = useRef(0);
  if (
    maskBrush.maskStrokes.length !== prevStrokesLen.current ||
    maskBrush.maskBoxes.length !== prevBoxesLen.current
  ) {
    prevStrokesLen.current = maskBrush.maskStrokes.length;
    prevBoxesLen.current = maskBrush.maskBoxes.length;
    requestAnimationFrame(drawMaskOverlay);
  }

  /** 提交 */
  const handleSubmit = useCallback(() => {
    if (!videoUrl || !maskBrush.hasMask || !prompt.trim()) return;

    const selection = maskBrush.buildMaskSelection(
      { toolId: "video-inpaint" },
      { id: "video-frame", width: frameWidth, height: frameHeight },
    );
    if (!selection) return;

    onSubmit({
      videoUrl,
      maskDataUrl: selection.maskDataUrl,
      maskBbox: selection.bbox,
      maskNormalizedBbox: selection.normalizedBbox,
      prompt: prompt.trim(),
      timestampSec,
    });
  }, [videoUrl, maskBrush, prompt, timestampSec, frameWidth, frameHeight, onSubmit]);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* 视频上传/预览 */}
      {!frameDataUrl ? (
        <div className="flex flex-col gap-3">
          <div
            className="border-2 border-dashed border-white/20 rounded-lg p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-white/40 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-white/50" />
            <span className="text-sm text-white/60">点击上传视频</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFileChange}
          />
          {videoUrl && (
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full rounded-lg"
              onLoadedData={handleVideoLoaded}
              crossOrigin="anonymous"
            />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* 首帧 + mask 绘制区域 */}
          <div className="relative rounded-lg overflow-hidden">
            <img
              src={frameDataUrl}
              alt="首帧"
              className="w-full"
              draggable={false}
            />
            <canvas
              ref={maskCanvasRef}
              width={frameWidth}
              height={frameHeight}
              className="absolute inset-0 w-full h-full cursor-crosshair"
              style={{ touchAction: "none" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
          </div>

          {/* 绘制工具栏 */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={maskBrush.undo}
              disabled={!maskBrush.canUndo}
              title="撤销"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={maskBrush.clearAll}
              disabled={!maskBrush.hasMask}
              title="清除 mask"
            >
              <Eraser className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2 ml-2">
              <Pencil className="w-3 h-3 text-white/50" />
              <input
                type="range"
                min={maskBrush.brushSizeMin}
                max={maskBrush.brushSizeMax}
                value={maskBrush.brushSize}
                onChange={(e) => maskBrush.setBrushSize(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-xs text-white/50">{maskBrush.brushSize}px</span>
            </div>
          </div>
        </div>
      )}

      {/* 关键帧时间 */}
      {frameDataUrl ? (
        <label className="flex items-center gap-2 text-xs text-white/60">
          <span className="shrink-0">关键帧时间</span>
          <input
            type="range"
            min={0}
            max={30}
            step={0.5}
            value={timestampSec}
            onChange={(e) => setTimestampSec(Number(e.target.value))}
            className="flex-1"
          />
          <span className="w-10 text-right tabular-nums">{timestampSec}s</span>
        </label>
      ) : null}

      {/* 编辑 prompt */}
      <textarea
        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-white/30"
        rows={2}
        placeholder="描述你要在 mask 区域进行的编辑，例如：将背景中的天空替换为星空"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      {/* 提交 */}
      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={!videoUrl || !maskBrush.hasMask || !prompt.trim() || submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            编辑中…
          </>
        ) : (
          "提交视频编辑"
        )}
      </Button>
    </div>
  );
}
