"use client";

import { useState, useCallback } from "react";
import { Download, ImagePlus, Maximize2, Star, X } from "lucide-react";
import Image from "next/image";

import { cn } from "@aimarket/ui";

const panelTheme = {
  node: {
    stroke: "var(--am-border, rgba(255,255,255,0.1))",
    panel: "var(--am-surface-strong, rgba(255,255,255,0.08))",
    faint: "#78716c",
  },
} as const;

/** 宫格模式：单格图片数据 */
export interface MultiCamCell {
  url?: string;
  label: string;
}

/** 画布模式：机位变体 */
export type MultiCamVariant = {
  id: string;
  url: string;
  label: string;
  cameraPosition?: string;
};

type MultiCamGridProps =
  | {
      variant?: "grid";
      cells: MultiCamCell[];
      cols?: number;
      rows?: number;
      onPreview?: (cell: MultiCamCell, index: number) => void;
      onSetReference?: (cell: MultiCamCell, index: number) => void;
    }
  | {
      variant: "canvas";
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

async function downloadImage(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, "_blank");
  }
}

function MultiCamGridLayout({
  cells,
  cols = 3,
  rows = 3,
  onPreview,
  onSetReference,
}: Extract<MultiCamGridProps, { variant?: "grid" }>) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const handlePreview = useCallback(
    (index: number) => {
      setPreviewIndex(index);
      onPreview?.(cells[index]!, index);
    },
    [cells, onPreview],
  );

  const totalSlots = cols * rows;
  const displayCells = cells.slice(0, totalSlots);
  while (displayCells.length < totalSlots) {
    displayCells.push({ label: `${displayCells.length + 1}` });
  }

  const previewCell = previewIndex !== null ? cells[previewIndex] : null;

  return (
    <div className="space-y-2">
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {displayCells.map((cell, idx) => (
          <div
            key={idx}
            className="group relative flex flex-col items-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] transition hover:border-white/20"
          >
            {cell.url ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cell.url}
                  alt={cell.label}
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/70 via-black/30 to-transparent py-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => handlePreview(idx)}
                    className="flex size-6 items-center justify-center rounded-md bg-white/10 text-zinc-300 transition hover:bg-white/20 hover:text-white"
                    title="放大预览"
                  >
                    <Maximize2 className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadImage(cell.url!, `multi-cam-${idx + 1}.png`)
                    }
                    className="flex size-6 items-center justify-center rounded-md bg-white/10 text-zinc-300 transition hover:bg-white/20 hover:text-white"
                    title="下载"
                  >
                    <Download className="size-3" />
                  </button>
                  {onSetReference ? (
                    <button
                      type="button"
                      onClick={() => onSetReference(cell, idx)}
                      className="flex size-6 items-center justify-center rounded-md bg-violet-500/20 text-violet-300 transition hover:bg-violet-500/30 hover:text-violet-100"
                      title="设为参考图"
                    >
                      <ImagePlus className="size-3" />
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="aspect-square w-full animate-pulse bg-white/5" />
            )}
            <span className="mt-0.5 text-[10px] text-zinc-500">{cell.label}</span>
          </div>
        ))}
      </div>

      {previewCell?.url && previewIndex !== null ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setPreviewIndex(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewCell.url}
              alt={previewCell.label}
              className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-zinc-300">{previewCell.label}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadImage(
                      previewCell.url!,
                      `multi-cam-${previewIndex + 1}.png`,
                    )
                  }
                  className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs text-zinc-300 hover:bg-white/20"
                >
                  <Download className="size-3" /> 下载
                </button>
                {onSetReference ? (
                  <button
                    type="button"
                    onClick={() => onSetReference(previewCell, previewIndex)}
                    className="flex items-center gap-1 rounded-md bg-violet-500/20 px-2 py-1 text-xs text-violet-300 hover:bg-violet-500/30"
                  >
                    <ImagePlus className="size-3" /> 设为参考图
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MultiCamCanvasCell({
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
  const label =
    variant.label ||
    CAMERA_LABELS_3X3[Math.floor(index / 3)]?.[index % 3] ||
    `CAM-${index + 1}`;

  return (
    <div
      className="group relative aspect-[9/16] cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-150"
      style={{
        borderColor: isHero ? "#f59e0b" : hovered ? panelTheme.node.stroke : "transparent",
        background: panelTheme.node.panel,
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
          style={{ color: panelTheme.node.faint }}
        >
          <span className="text-[10px]">{label.split(" ")[0]}</span>
        </div>
      )}

      <div
        className="absolute bottom-0 left-0 right-0 px-1.5 py-1 text-[9px] font-medium leading-tight"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
          color: "#fff",
        }}
      >
        {label}
      </div>

      {isHero ? (
        <div className="absolute left-1.5 top-1.5">
          <Star className="size-3.5 fill-amber-400 text-amber-400" />
        </div>
      ) : null}

      {hovered ? (
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
      ) : null}
    </div>
  );
}

function MultiCamCanvasGrid({
  variants,
  gridSize = 3,
  heroIndex,
  onSelect,
  onSetHero,
  onDownload,
  className,
}: Extract<MultiCamGridProps, { variant: "canvas" }>) {
  const [expandedVariant, setExpandedVariant] = useState<MultiCamVariant | null>(
    null,
  );
  const gridClass = gridSize === 3 ? "grid-cols-3" : "grid-cols-5";

  const handleSelect = useCallback(
    (v: MultiCamVariant, i: number) => {
      onSelect?.(v, i);
    },
    [onSelect],
  );

  const handleDownload = useCallback(
    (v: MultiCamVariant, i: number) => {
      if (v.url) {
        const a = document.createElement("a");
        a.href = v.url;
        a.download = v.label || `cam-${v.id}`;
        a.click();
      }
      onDownload?.(v, i);
    },
    [onDownload],
  );

  const cellCount = gridSize * gridSize;
  const paddedVariants = [...variants];
  while (paddedVariants.length < cellCount) {
    paddedVariants.push({
      id: `empty-${paddedVariants.length}`,
      url: "",
      label: "",
    });
  }

  return (
    <>
      <div className={cn("grid gap-1.5 p-1", gridClass, className)}>
        {paddedVariants.slice(0, cellCount).map((variant, i) => (
          <MultiCamCanvasCell
            key={variant.id}
            variant={variant}
            index={i}
            gridSize={gridSize}
            isHero={heroIndex === i}
            onSelect={handleSelect}
            onSetHero={(v, idx) => onSetHero?.(v, idx)}
            onDownload={handleDownload}
            onExpand={(v) => setExpandedVariant(v)}
          />
        ))}
      </div>

      {expandedVariant ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80"
          onClick={() => setExpandedVariant(null)}
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
              <div
                className="flex h-64 w-32 items-center justify-center rounded-xl"
                style={{ background: panelTheme.node.panel }}
              >
                <span style={{ color: panelTheme.node.faint }}>
                  {expandedVariant.label}
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setExpandedVariant(null)}
            className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="关闭"
          >
            <X className="size-5" />
          </button>
        </div>
      ) : null}
    </>
  );
}

/** 多机位宫格：`grid` 工具结果弹层 / `canvas` Infinite 分镜节点 */
export function MultiCamGrid(props: MultiCamGridProps) {
  if (props.variant === "canvas") {
    return <MultiCamCanvasGrid {...props} />;
  }
  return <MultiCamGridLayout {...props} />;
}
