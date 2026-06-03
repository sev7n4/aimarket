"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import {
  EXPAND_ASPECT_PRESETS,
  applyAspectToPadding,
  defaultExpandPadding,
  resizePaddingFromHandle,
  type ExpandAspectPreset,
  type ExpandFramePadding,
  type ExpandHandle,
} from "@/lib/expand-frame";

const HANDLES: Array<{ id: ExpandHandle; cursor: string; x: string; y: string }> = [
  { id: "top-left", cursor: "nwse-resize", x: "0%", y: "0%" },
  { id: "top", cursor: "ns-resize", x: "50%", y: "0%" },
  { id: "top-right", cursor: "nesw-resize", x: "100%", y: "0%" },
  { id: "right", cursor: "ew-resize", x: "100%", y: "50%" },
  { id: "bottom-right", cursor: "nesw-resize", x: "100%", y: "100%" },
  { id: "bottom", cursor: "ns-resize", x: "50%", y: "100%" },
  { id: "bottom-left", cursor: "nesw-resize", x: "0%", y: "100%" },
  { id: "left", cursor: "ew-resize", x: "0%", y: "50%" },
];

interface ExpandFrameOverlayProps {
  imageWidth: number;
  imageHeight: number;
  initialAspect?: ExpandAspectPreset;
  onComplete: (padding: ExpandFramePadding, aspect: ExpandAspectPreset) => void;
  onCancel: () => void;
}

export function ExpandFrameOverlay({
  imageWidth,
  imageHeight,
  initialAspect = "free",
  onComplete,
  onCancel,
}: ExpandFrameOverlayProps) {
  const [aspect, setAspect] = useState<ExpandAspectPreset>(initialAspect);
  const [padding, setPadding] = useState<ExpandFramePadding>(() =>
    applyAspectToPadding(
      defaultExpandPadding(imageWidth, imageHeight),
      imageWidth,
      imageHeight,
      initialAspect,
    ),
  );
  const dragRef = useRef<{
    handle: ExpandHandle;
    startX: number;
    startY: number;
    startPadding: ExpandFramePadding;
  } | null>(null);

  useEffect(() => {
    setPadding((prev) =>
      applyAspectToPadding(prev, imageWidth, imageHeight, aspect),
    );
  }, [aspect, imageWidth, imageHeight]);

  const onAspectChange = useCallback(
    (preset: ExpandAspectPreset) => {
      setAspect(preset);
      setPadding((prev) =>
        applyAspectToPadding(prev, imageWidth, imageHeight, preset),
      );
    },
    [imageWidth, imageHeight],
  );

  function onHandlePointerDown(
    e: React.PointerEvent,
    handle: ExpandHandle,
  ) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startPadding: { ...padding },
    };
  }

  function onHandlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setPadding(
      resizePaddingFromHandle(
        drag.startPadding,
        imageWidth,
        imageHeight,
        drag.handle,
        dx,
        dy,
        aspect,
      ),
    );
  }

  function endHandlePointer() {
    dragRef.current = null;
  }

  const frameW = imageWidth + padding.left + padding.right;
  const frameH = imageHeight + padding.top + padding.bottom;

  return (
    <div
      className="absolute inset-0 z-20 touch-none"
      style={{
        left: -padding.left,
        top: -padding.top,
        width: frameW,
        height: frameH,
      }}
    >
      <div
        className="absolute inset-0 border-2 border-dashed border-orange-400/70 bg-orange-500/5"
        aria-hidden
      />
      <div
        className="absolute border-2 border-orange-300/90 bg-black/20"
        style={{
          left: padding.left,
          top: padding.top,
          width: imageWidth,
          height: imageHeight,
        }}
      />

      {HANDLES.map((h) => (
        <button
          key={h.id}
          type="button"
          className="absolute z-30 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-orange-300 bg-orange-500 shadow-md"
          style={{
            left: h.x,
            top: h.y,
            cursor: h.cursor,
          }}
          aria-label={`调整扩图 ${h.id}`}
          onPointerDown={(e) => onHandlePointerDown(e, h.id)}
          onPointerMove={onHandlePointerMove}
          onPointerUp={endHandlePointer}
          onPointerCancel={endHandlePointer}
        />
      ))}

      <div className="pointer-events-none absolute -top-10 left-0 right-0 flex justify-center">
        <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-full border border-orange-400/30 bg-black/85 px-2 py-1 shadow-lg backdrop-blur">
          <Maximize2 className="size-3 text-orange-300" />
          {EXPAND_ASPECT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onAspectChange(p.id)}
              className={`rounded-full px-2 py-0.5 text-[10px] ${
                aspect === p.id
                  ? "bg-orange-500 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onComplete(padding, aspect)}
            className="ml-1 rounded-full bg-orange-500 px-2.5 py-0.5 text-[10px] font-medium text-white"
          >
            确认扩图
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-zinc-400"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
