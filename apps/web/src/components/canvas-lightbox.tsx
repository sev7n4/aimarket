"use client";

import { useEffect, useCallback, useState } from "react";
import { assetUrl } from "@/lib/api-client";
import {
  X,
  RotateCcw,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Wand2,
} from "lucide-react";
import { MOBILE_BREAKPOINT } from "@/lib/breakpoints";
import { useIsMobile } from "@/hooks/use-is-mobile";

interface CanvasLightboxProps {
  items: Array<{
    id: string;
    url: string;
    isVideo?: boolean;
    label?: string;
  }>;
  initialIndex: number;
  onClose: () => void;
  /** Studio 画布预览：进入自由画布精修 */
  onRefine?: () => void;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.5;

export function CanvasLightbox({
  items,
  initialIndex,
  onClose,
  onRefine,
}: CanvasLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number; px: number; py: number } | null>(null);
  const mobile = useIsMobile(MOBILE_BREAKPOINT);

  const current = items[index];
  const hasNext = index < items.length - 1;
  const hasPrev = index > 0;

  const handleRotateLeft = useCallback(() => {
    setRotation((r) => (r - 90 + 360) % 360);
  }, []);

  const handleRotateRight = useCallback(() => {
    setRotation((r) => (r + 90) % 360);
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }, []);

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      setIndex((i) => i - 1);
      handleResetZoom();
    }
  }, [hasPrev, handleResetZoom]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      setIndex((i) => i + 1);
      handleResetZoom();
    }
  }, [hasNext, handleResetZoom]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (zoom <= 1) return;
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      px: pan.x,
      py: pan.y,
    });
  }, [zoom, pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStart) return;
    setPan({
      x: dragStart.px + (e.clientX - dragStart.x),
      y: dragStart.py + (e.clientY - dragStart.y),
    });
  }, [dragStart]);

  const handlePointerUp = useCallback(() => {
    setDragStart(null);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") handlePrev();
      else if (e.key === "ArrowRight") handleNext();
      else if (e.key === "0") handleResetZoom();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, handlePrev, handleNext, handleResetZoom]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          {current.label && (
            <span className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white/80">
              {current.label}
            </span>
          )}
          <span className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white/60">
            {index + 1} / {items.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onRefine && !current.isVideo ? (
            <button
              type="button"
              data-testid="lightbox-refine-btn"
              onClick={() => {
                onRefine();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500/90 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-orange-400"
              title="进入精修模式：圈选、对比、连续迭代"
            >
              <Wand2 className="size-4" />
              精修此图
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 p-2 text-white/80 transition hover:bg-white/20 hover:text-white"
            title="关闭"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
        <button
          type="button"
          onClick={handleRotateLeft}
          className="rounded-lg bg-white/10 p-2 text-white/80 transition hover:bg-white/20"
          title="逆时针旋转"
        >
          <RotateCcw className="size-4" />
        </button>
        <input
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={0.1}
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          className="w-32 accent-orange-500"
          title="缩放"
        />
        <button
          type="button"
          onClick={handleRotateRight}
          className="rounded-lg bg-white/10 p-2 text-white/80 transition hover:bg-white/20"
          title="顺时针旋转"
        >
          <RotateCw className="size-4" />
        </button>
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <button
          type="button"
          onClick={handleResetZoom}
          className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white/80 transition hover:bg-white/20"
          title="重置"
        >
          {Math.round(zoom * 100)}%
        </button>
      </div>

      {hasPrev && (
        <button
          type="button"
          onClick={handlePrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 p-3 text-white/80 transition hover:bg-white/20 hover:text-white"
          title="上一张"
        >
          <ChevronLeft className="size-6" />
        </button>
      )}

      {hasNext && (
        <button
          type="button"
          onClick={handleNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 p-3 text-white/80 transition hover:bg-white/20 hover:text-white"
          title="下一张"
        >
          <ChevronRight className="size-6" />
        </button>
      )}

      <div
        className="relative max-h-[85vh] max-w-[85vw] overflow-hidden"
        style={{
          cursor: zoom > 1 ? (dragStart ? "grabbing" : "grab") : "default",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            transition: dragStart ? "none" : "transform 0.2s ease-out",
          }}
        >
          {current.isVideo ? (
            <video
              src={assetUrl(current.url)}
              controls
              autoPlay
              className="max-h-[85vh] max-w-[85vw] rounded-lg"
            />
          ) : (
            <img
              src={assetUrl(current.url)}
              alt=""
              className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
              draggable={false}
            />
          )}
        </div>
      </div>

      {mobile && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-xs text-white/50">
          双指缩放 · 左右滑动切换
        </div>
      )}
    </div>
  );
}