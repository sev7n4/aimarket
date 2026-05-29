"use client";

import { useEffect, useCallback, useState } from "react";
import { assetUrl } from "@/lib/api-client";
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
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
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.5;

export function CanvasLightbox({
  items,
  initialIndex,
  onClose,
}: CanvasLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number; px: number; py: number } | null>(null);
  const mobile = useIsMobile(MOBILE_BREAKPOINT);

  const current = items[index];
  const hasNext = index < items.length - 1;
  const hasPrev = index > 0;

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
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
      else if (e.key === "+" || e.key === "=") handleZoomIn();
      else if (e.key === "-") handleZoomOut();
      else if (e.key === "0") handleResetZoom();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, handlePrev, handleNext, handleZoomIn, handleZoomOut, handleResetZoom]);

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
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 p-2 text-white/80 transition hover:bg-white/20 hover:text-white"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
        <button
          type="button"
          onClick={handleZoomOut}
          disabled={zoom <= ZOOM_MIN}
          className="rounded-lg bg-white/10 p-2 text-white/80 transition hover:bg-white/20 disabled:opacity-40"
        >
          <ZoomOut className="size-4" />
        </button>
        <button
          type="button"
          onClick={handleResetZoom}
          className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white/80 transition hover:bg-white/20"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={handleZoomIn}
          disabled={zoom >= ZOOM_MAX}
          className="rounded-lg bg-white/10 p-2 text-white/80 transition hover:bg-white/20 disabled:opacity-40"
        >
          <ZoomIn className="size-4" />
        </button>
      </div>

      {hasPrev && (
        <button
          type="button"
          onClick={handlePrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 p-3 text-white/80 transition hover:bg-white/20 hover:text-white"
        >
          <ChevronLeft className="size-6" />
        </button>
      )}

      {hasNext && (
        <button
          type="button"
          onClick={handleNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 p-3 text-white/80 transition hover:bg-white/20 hover:text-white"
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
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
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