"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { assetUrl } from "@/lib/api-client";
import type { CanvasItem, CanvasToolId } from "@/lib/canvas-tools";
import { CanvasToolbar } from "@/components/canvas-toolbar";

interface DesignCanvasProps {
  items: CanvasItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpload: () => void;
  onDownload: () => void;
  emptyHint?: string;
}

export function DesignCanvas({
  items,
  selectedId,
  onSelect,
  onUpload,
  onDownload,
  emptyHint = "生成结果将显示在画布上",
}: DesignCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<CanvasToolId>("select");
  const [gridOn, setGridOn] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panStart = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );

  const handleTool = useCallback(
    (id: CanvasToolId) => {
      if (id === "zoom-in") setZoom((z) => Math.min(2, z + 0.15));
      else if (id === "zoom-out") setZoom((z) => Math.max(0.35, z - 0.15));
      else if (id === "fit") {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      } else if (id === "grid") setGridOn((g) => !g);
      else if (id === "upload") onUpload();
      else if (id === "download") onDownload();
      else setTool(id);
    },
    [onUpload, onDownload],
  );

  function onPointerDown(e: React.PointerEvent) {
    if (tool !== "pan") return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      px: pan.x,
      py: pan.y,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!panStart.current || tool !== "pan") return;
    setPan({
      x: panStart.current.px + (e.clientX - panStart.current.x),
      y: panStart.current.py + (e.clientY - panStart.current.y),
    });
  }

  function onPointerUp() {
    panStart.current = null;
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom((z) =>
          Math.min(2, Math.max(0.35, z + (e.deltaY > 0 ? -0.08 : 0.08))),
        );
      }
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d0d]">
      <CanvasToolbar active={tool} gridOn={gridOn} onTool={handleTool} />

      <div
        ref={containerRef}
        className={`relative min-h-0 flex-1 overflow-hidden ${
          tool === "pan" ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClick={() => tool === "select" && onSelect(null)}
      >
        {gridOn ? (
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
              backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
              backgroundPosition: `${pan.x}px ${pan.y}px`,
            }}
          />
        ) : (
          <div className="pointer-events-none absolute inset-0 bg-[#0d0d0d]" />
        )}

        <div
          className="absolute left-0 top-0 origin-top-left transition-transform duration-100"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {items.length === 0 ? (
            <div className="flex h-[min(60vh,480px)] w-[min(90vw,720px)] items-center justify-center p-8">
              <p className="text-sm text-zinc-600">{emptyHint}</p>
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                style={{
                  position: "absolute",
                  left: item.x,
                  top: item.y,
                  width: item.width,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (tool === "select") onSelect(item.id);
                }}
                className={`overflow-hidden rounded-xl border-2 bg-zinc-900 text-left shadow-lg transition ${
                  selectedId === item.id
                    ? "border-orange-500 ring-2 ring-orange-500/30"
                    : "border-white/10 hover:border-white/25"
                }`}
              >
                {item.label ? (
                  <span className="block bg-black/60 px-2 py-0.5 text-[10px] text-zinc-400">
                    {item.label}
                  </span>
                ) : null}
                {item.isVideo ? (
                  <video
                    src={assetUrl(item.url)}
                    className="w-full object-cover"
                    style={{ height: item.height }}
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={assetUrl(item.url)}
                    alt=""
                    className="w-full object-cover"
                    style={{ height: item.height }}
                    draggable={false}
                  />
                )}
              </button>
            ))
          )}
        </div>

        <div className="absolute bottom-3 right-3 rounded-lg bg-black/60 px-2 py-1 text-[10px] text-zinc-500">
          {Math.round(zoom * 100)}%
        </div>
      </div>
    </div>
  );
}
