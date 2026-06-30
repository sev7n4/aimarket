"use client";

import React, { useState, useCallback, useRef } from "react";

import { canvasTheme } from "../canvas-theme";

export type LightSource = {
  id: string;
  x: number; // 0-100 percentage
  y: number;
  colorTemp: "warm" | "neutral" | "cool";
  intensity: number; // 0-100
  type: "point" | "area" | "spotlight";
};

export type LightingOverlayProps = {
  imageUrl: string;
  sources?: LightSource[];
  onSourcesChange?: (sources: LightSource[]) => void;
  className?: string;
};

const LIGHT_COLORS = {
  warm: "#fef3c7",
  neutral: "#f0f9ff",
  cool: "#dbeafe",
};

const LIGHT_GLOW = {
  warm: "rgba(254, 243, 199, 0.4)",
  neutral: "rgba(240, 249, 255, 0.4)",
  cool: "rgba(219, 234, 254, 0.4)",
};

function LightDot({
  source,
  selected,
  onSelect,
  onDrag,
}: {
  source: LightSource;
  selected: boolean;
  onSelect: (id: string) => void;
  onDrag: (id: string, x: number, y: number) => void;
}) {
  const dotRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(source.id);
      dragging.current = true;
      startPos.current = { x: e.clientX, y: e.clientY };

      const handleMove = (moveEvent: MouseEvent) => {
        if (!dragging.current || !dotRef.current?.parentElement) return;
        const parent = dotRef.current.parentElement;
        const rect = parent.getBoundingClientRect();
        const newX = ((moveEvent.clientX - rect.left) / rect.width) * 100;
        const newY = ((moveEvent.clientY - rect.top) / rect.height) * 100;
        onDrag(source.id, Math.max(0, Math.min(100, newX)), Math.max(0, Math.min(100, newY)));
      };

      const handleUp = () => {
        dragging.current = false;
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [source.id, onSelect, onDrag],
  );

  return (
    <div
      ref={dotRef}
      className="absolute flex size-4 -translate-x-1/2 -translate-y-1/2 cursor-move items-center justify-center rounded-full border-2 transition-all"
      style={{
        left: `${source.x}%`,
        top: `${source.y}%`,
        borderColor: LIGHT_COLORS[source.colorTemp],
        background: LIGHT_GLOW[source.colorTemp],
        boxShadow: selected ? `0 0 0 3px ${LIGHT_COLORS[source.colorTemp]}, 0 0 16px ${LIGHT_GLOW[source.colorTemp]}` : undefined,
      }}
      onMouseDown={handleMouseDown}
      role="button"
      tabIndex={0}
      aria-label={`光源 ${source.id}`}
    >
      <div
        className="size-1.5 rounded-full"
        style={{ background: LIGHT_COLORS[source.colorTemp] }}
      />
    </div>
  );
}

function LightControls({
  sources,
  selectedId,
  onUpdate,
  onDelete,
}: {
  sources: LightSource[];
  selectedId: string | null;
  onUpdate: (id: string, patch: Partial<LightSource>) => void;
  onDelete: (id: string) => void;
}) {
  const selected = sources.find((s) => s.id === selectedId);
  if (!selected) {
    return (
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between rounded-lg px-3 py-1.5 text-[10px]" style={{ background: "rgba(0,0,0,0.7)", color: canvasTheme.node.faint }}>
        点击图片添加光源
      </div>
    );
  }

  return (
    <div className="absolute bottom-2 left-2 right-2 rounded-lg p-2" style={{ background: "rgba(0,0,0,0.8)" }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-white">光源属性</span>
        <button
          type="button"
          onClick={() => onDelete(selected.id)}
          className="text-[10px] text-red-400 hover:text-red-300"
        >
          删除
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        {/* Color temperature */}
        <div className="flex items-center gap-2">
          <span className="w-14 text-[10px]" style={{ color: canvasTheme.node.faint }}>色温</span>
          <div className="flex gap-1">
            {(["warm", "neutral", "cool"] as const).map((temp) => (
              <button
                key={temp}
                type="button"
                onClick={() => onUpdate(selected.id, { colorTemp: temp })}
                className="size-5 rounded-full border transition-all"
                style={{
                  background: LIGHT_COLORS[temp],
                  borderColor: selected.colorTemp === temp ? "#fff" : "transparent",
                }}
                title={temp === "warm" ? "暖光" : temp === "neutral" ? "自然光" : "冷光"}
              />
            ))}
          </div>
        </div>
        {/* Light type */}
        <div className="flex items-center gap-2">
          <span className="w-14 text-[10px]" style={{ color: canvasTheme.node.faint }}>类型</span>
          <div className="flex gap-1">
            {(["point", "area", "spotlight"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onUpdate(selected.id, { type })}
                className="rounded px-1.5 py-0.5 text-[9px] transition-all"
                style={{
                  background: selected.type === type ? "#6366f1" : "rgba(255,255,255,0.1)",
                  color: selected.type === type ? "#fff" : canvasTheme.node.faint,
                }}
              >
                {type === "point" ? "点光" : type === "area" ? "面光" : "聚光"}
              </button>
            ))}
          </div>
        </div>
        {/* Intensity */}
        <div className="flex items-center gap-2">
          <span className="w-14 text-[10px]" style={{ color: canvasTheme.node.faint }}>强度</span>
          <input
            type="range"
            min={0}
            max={100}
            value={selected.intensity}
            onChange={(e) => onUpdate(selected.id, { intensity: Number(e.target.value) })}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full"
            title="光源强度"
            style={{ background: `linear-gradient(to right, ${LIGHT_COLORS[selected.colorTemp]} ${selected.intensity}%, rgba(255,255,255,0.1) ${selected.intensity}%)` }}
          />
          <span className="w-6 text-right text-[10px] text-white">{selected.intensity}</span>
        </div>
      </div>
    </div>
  );
}

export function LightingOverlay({ imageUrl, sources = [], onSourcesChange, className }: LightingOverlayProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!editMode || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      const newSource: LightSource = {
        id: `light-${Date.now()}`,
        x,
        y,
        colorTemp: "warm",
        intensity: 60,
        type: "point",
      };
      onSourcesChange?.([...sources, newSource]);
      setSelectedId(newSource.id);
    },
    [editMode, sources, onSourcesChange],
  );

  const handleUpdate = useCallback(
    (id: string, patch: Partial<LightSource>) => {
      onSourcesChange?.(sources.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    },
    [sources, onSourcesChange],
  );

  const handleDelete = useCallback(
    (id: string) => {
      onSourcesChange?.(sources.filter((s) => s.id !== id));
      if (selectedId === id) setSelectedId(null);
    },
    [sources, selectedId, onSourcesChange],
  );

  const handleDrag = useCallback(
    (id: string, x: number, y: number) => {
      handleUpdate(id, { x, y });
    },
    [handleUpdate],
  );

  return (
    <div ref={containerRef} className={`relative ${className || ""}`} onClick={handleImageClick}>
      {/* Background image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="灯光参考"
        className="w-full select-none"
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
      />

      {/* Light source dots */}
      {editMode &&
        sources.map((source) => (
          <LightDot
            key={source.id}
            source={source}
            selected={selectedId === source.id}
            onSelect={setSelectedId}
            onDrag={handleDrag}
          />
        ))}

      {/* Controls panel */}
      <LightControls
        sources={sources}
        selectedId={selectedId}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      {/* Edit mode toggle */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setEditMode((m) => !m);
        }}
        className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-md text-[10px] font-bold transition"
        style={{
          background: editMode ? "#6366f1" : "rgba(0,0,0,0.6)",
          color: "#fff",
        }}
        title={editMode ? "退出灯光编辑" : "编辑灯光"}
      >
        ✦
      </button>
    </div>
  );
}
