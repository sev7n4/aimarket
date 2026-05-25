"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { assetUrl } from "@/lib/api-client";
import type { CanvasItem, CanvasToolId } from "@/lib/canvas-tools";
import { CanvasToolbar } from "@/components/canvas-toolbar";

interface DesignCanvasProps {
  items: CanvasItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onItemsChange: (items: CanvasItem[]) => void;
  onUpload: () => void;
  onDownload: () => void;
  onDeleteSelected: () => void;
  emptyHint?: string;
  readOnly?: boolean;
}

export function DesignCanvas({
  items,
  selectedId,
  onSelect,
  onItemsChange,
  onUpload,
  onDownload,
  onDeleteSelected,
  emptyHint = "生成结果将显示在画布上",
  readOnly = false,
}: DesignCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<CanvasToolId>("select");
  const [gridOn, setGridOn] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panStart = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const handleTool = useCallback(
    (id: CanvasToolId) => {
      if (id === "zoom-in") setZoom((z) => Math.min(2, z + 0.15));
      else if (id === "zoom-out") setZoom((z) => Math.max(0.35, z - 0.15));
      else if (id === "fit") {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      } else if (id === "grid") setGridOn((g) => !g);
      else if (id === "upload") {
        if (!readOnly) onUpload();
      } else if (id === "download") onDownload();
      else if (id === "delete") {
        if (readOnly) return;
        if (selectedId) onDeleteSelected();
        else setTool("select");
      } else setTool(id);
    },
    [onUpload, onDownload, onDeleteSelected, selectedId, readOnly],
  );

  function onCanvasPointerDown(e: React.PointerEvent) {
    if (tool !== "pan") return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      px: pan.x,
      py: pan.y,
    };
  }

  function onCanvasPointerMove(e: React.PointerEvent) {
    if (!readOnly && dragRef.current && tool === "select") {
      const d = dragRef.current;
      const dx = (e.clientX - d.startX) / zoom;
      const dy = (e.clientY - d.startY) / zoom;
      onItemsChange(
        items.map((it) =>
          it.id === d.id
            ? { ...it, x: d.originX + dx, y: d.originY + dy }
            : it,
        ),
      );
      return;
    }
    if (!panStart.current || tool !== "pan") return;
    setPan({
      x: panStart.current.px + (e.clientX - panStart.current.x),
      y: panStart.current.py + (e.clientY - panStart.current.y),
    });
  }

  function endPointer() {
    panStart.current = null;
    dragRef.current = null;
  }

  function onItemPointerDown(e: React.PointerEvent, item: CanvasItem) {
    if (tool !== "select") return;
    e.stopPropagation();
    onSelect(item.id);
    if (readOnly) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      id: item.id,
      startX: e.clientX,
      startY: e.clientY,
      originX: item.x,
      originY: item.y,
    };
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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (readOnly || !selectedId) return;
      e.preventDefault();
      onDeleteSelected();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, onDeleteSelected, readOnly]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d0d]">
      <CanvasToolbar active={tool} gridOn={gridOn} onTool={handleTool} />

      <div
        ref={containerRef}
        className={`relative min-h-0 flex-1 overflow-hidden ${
          tool === "pan"
            ? "cursor-grab active:cursor-grabbing"
            : tool === "select"
              ? "cursor-default"
              : "cursor-default"
        }`}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={endPointer}
        onPointerLeave={endPointer}
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
          className="absolute left-0 top-0 origin-top-left"
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
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                style={{
                  position: "absolute",
                  left: item.x,
                  top: item.y,
                  width: item.width,
                }}
                onPointerDown={(e) => onItemPointerDown(e, item)}
                onClick={(e) => e.stopPropagation()}
                className={`overflow-hidden rounded-xl border-2 bg-zinc-900 text-left shadow-lg transition ${
                  tool === "select" ? "cursor-grab active:cursor-grabbing" : ""
                } ${
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
                    className="w-full object-cover pointer-events-none"
                    style={{ height: item.height }}
                    draggable={false}
                  />
                )}
              </div>
            ))
          )}
        </div>

        <div className="absolute bottom-3 right-3 rounded-lg bg-black/60 px-2 py-1 text-[10px] text-zinc-500">
          {Math.round(zoom * 100)}%
          {selectedId ? " · 可拖拽 · Del 删除" : ""}
        </div>
      </div>
    </div>
  );
}
