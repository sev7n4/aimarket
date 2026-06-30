"use client";

import React, { useState, useCallback } from "react";
import { Download, Maximize2, X, Star } from "lucide-react";
import Image from "next/image";

import { canvasTheme } from "../canvas-theme";
import { cn } from "@aimarket/ui";

export type MultiCamVariant = {
  id: string;
  url: string;
  label: string;
  cameraPosition?: string; // e.g., "CAM-01", "wide", "close-up"
};

export type MultiCamGridProps = {
  variants: MultiCamVariant[];
  gridSize?: 3 | 5;
  heroIndex?: number;
  onSelect?: (variant: MultiCamVariant, index: number) => void;
  onSetHero?: (variant: MultiCamVariant, index: number) => void;
  onDownload?: (variant: MultiCamVariant, index: number) => void;
  className?: string;
};

const CAMERA_LABELS_3X3 = [
  ["CAM-01 超远景", "CAM-02 远景", "CAM-03 大远景"],
  ["CAM-04 全景", "CAM-05 中景", "CAM-06 近景"],
  ["CAM-07 特写", "CAM-08 大特写", "CAM-09 极端特写"],
];

const CAMERA_LABELS_5X5 = Array.from({ length: 5 }, (_, row) =>
  Array.from({ length: 5 }, (_, col) => {
    const positions = ["超远景", "远景", "全景", "中景", "近景", "特写", "大特写"];
    return `CAM-${row * 5 + col + 1} ${positions[col] ?? ""}`;
  }),
);

function MultiCamCell({
  variant,
  index,
  gridSize,
  isHero,
  onSelect,
  onSetHero,
  onDownload,
  onExpand,
}: {
  variant: MultiCamVariant;
  index: number;
  gridSize: 3 | 5;
  isHero: boolean;
  onSelect: (v: MultiCamVariant, i: number) => void;
  onSetHero: (v: MultiCamVariant, i: number) => void;
  onDownload: (v: MultiCamVariant, i: number) => void;
  onExpand: (v: MultiCamVariant, i: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const label = variant.label || CAMERA_LABELS_3X3[Math.floor(index / 3)]?.[index % 3] || `CAM-${index + 1}`;
  const gridClass = gridSize === 3 ? "grid-cols-3" : "grid-cols-5";

  return (
    <div
      className="group relative aspect-[9/16] cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-150"
      style={{
        borderColor: isHero ? "#f59e0b" : hovered ? canvasTheme.node.stroke : "transparent",
        background: canvasTheme.node.panel,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(variant, index)}
      onDoubleClick={() => onExpand(variant, index)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect(variant, index)}
      aria-label={label}
    >
      {/* Image */}
      {variant.url ? (
        <Image
          src={variant.url}
          alt={label}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 160px"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center"
          style={{ color: canvasTheme.node.faint }}
        >
          <span className="text-[10px]">{label.split(" ")[0]}</span>
        </div>
      )}

      {/* Label */}
      <div
        className="absolute bottom-0 left-0 right-0 px-1.5 py-1 text-[9px] font-medium leading-tight"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
          color: "#fff",
        }}
      >
        {label}
      </div>

      {/* Hero badge */}
      {isHero && (
        <div className="absolute left-1.5 top-1.5">
          <Star className="size-3.5 fill-amber-400 text-amber-400" />
        </div>
      )}

      {/* Hover actions */}
      {hovered && (
        <div
          className="absolute right-1.5 top-1.5 flex flex-col gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSetHero(variant, index);
            }}
            className="flex size-5 items-center justify-center rounded-md bg-black/60 text-amber-400 transition hover:bg-black/80"
            title="设为主图"
          >
            <Star className="size-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDownload(variant, index);
            }}
            className="flex size-5 items-center justify-center rounded-md bg-black/60 text-white transition hover:bg-black/80"
            title="下载"
          >
            <Download className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export function MultiCamGrid({
  variants,
  gridSize = 3,
  heroIndex,
  onSelect,
  onSetHero,
  onDownload,
  className,
}: MultiCamGridProps) {
  const [expandedVariant, setExpandedVariant] = useState<MultiCamVariant | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const gridClass = gridSize === 3 ? "grid-cols-3" : "grid-cols-5";

  const handleSelect = useCallback(
    (v: MultiCamVariant, i: number) => {
      setSelectedIndex(i);
      onSelect?.(v, i);
    },
    [onSelect],
  );

  const handleSetHero = useCallback(
    (v: MultiCamVariant, i: number) => {
      onSetHero?.(v, i);
    },
    [onSetHero],
  );

  const handleDownload = useCallback(
    (v: MultiCamVariant) => {
      if (v.url) {
        const a = document.createElement("a");
        a.href = v.url;
        a.download = v.label || `cam-${v.id}`;
        a.click();
      }
    },
    [],
  );

  const handleExpand = useCallback((v: MultiCamVariant) => {
    setExpandedVariant(v);
  }, []);

  const closeExpand = useCallback(() => setExpandedVariant(null), []);

  // Pad variants to fill grid
  const cellCount = gridSize * gridSize;
  const paddedVariants = [...variants];
  while (paddedVariants.length < cellCount) {
    paddedVariants.push({ id: `empty-${paddedVariants.length}`, url: "", label: "" });
  }

  return (
    <>
      <div className={cn("grid gap-1.5 p-1", gridClass, className)}>
        {paddedVariants.slice(0, cellCount).map((variant, i) => (
          <MultiCamCell
            key={variant.id}
            variant={variant}
            index={i}
            gridSize={gridSize}
            isHero={heroIndex === i}
            onSelect={handleSelect}
            onSetHero={handleSetHero}
            onDownload={handleDownload}
            onExpand={handleExpand}
          />
        ))}
      </div>

      {/* Expanded fullscreen overlay */}
      {expandedVariant && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80"
          onClick={closeExpand}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]">
            {expandedVariant.url ? (
              <Image
                src={expandedVariant.url}
                alt={expandedVariant.label}
                width={1080}
                height={1920}
                className="max-h-[90vh] w-auto rounded-xl object-contain"
              />
            ) : (
              <div className="flex h-64 w-32 items-center justify-center rounded-xl" style={{ background: canvasTheme.node.panel }}>
                <span style={{ color: canvasTheme.node.faint }}>{expandedVariant.label}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={closeExpand}
            className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="关闭"
          >
            <X className="size-5" />
          </button>
        </div>
      )}
    </>
  );
}
