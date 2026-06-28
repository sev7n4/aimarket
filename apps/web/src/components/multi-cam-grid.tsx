"use client";

import { useState, useCallback } from "react";
import { Download, Maximize2, ImagePlus } from "lucide-react";

/** 单格图片数据 */
export interface MultiCamCell {
  /** 图片 URL，为空时显示骨架屏 */
  url?: string;
  /** 格子标签（如"俯拍"、"远景"） */
  label: string;
}

interface MultiCamGridProps {
  /** 宫格数据 */
  cells: MultiCamCell[];
  /** 列数，默认 3 */
  cols?: number;
  /** 行数，默认 3 */
  rows?: number;
  /** 点击放大回调 */
  onPreview?: (cell: MultiCamCell, index: number) => void;
  /** 设为参考图回调 */
  onSetReference?: (cell: MultiCamCell, index: number) => void;
}

/** 下载图片到本地 */
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
    // 降级：直接打开链接
    window.open(url, "_blank");
  }
}

/**
 * 多机位宫格展示组件
 *
 * 支持 3×3（9宫格）和 5×5（25宫格）布局，
 * 每格显示缩略图，点击可放大预览、下载、设为参考图。
 */
export function MultiCamGrid({
  cells,
  cols = 3,
  rows = 3,
  onPreview,
  onSetReference,
}: MultiCamGridProps) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const handlePreview = useCallback(
    (index: number) => {
      setPreviewIndex(index);
      onPreview?.(cells[index]!, index);
    },
    [cells, onPreview],
  );

  const handleClosePreview = useCallback(() => {
    setPreviewIndex(null);
  }, []);

  const totalSlots = cols * rows;
  const displayCells = cells.slice(0, totalSlots);
  // 不足的格子用空占位
  while (displayCells.length < totalSlots) {
    displayCells.push({ label: `${displayCells.length + 1}` });
  }

  const previewCell =
    previewIndex !== null ? cells[previewIndex] : null;

  return (
    <div className="space-y-2">
      {/* 宫格 */}
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
                {/* 悬浮操作栏 */}
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
                  {onSetReference && (
                    <button
                      type="button"
                      onClick={() => onSetReference(cell, idx)}
                      className="flex size-6 items-center justify-center rounded-md bg-violet-500/20 text-violet-300 transition hover:bg-violet-500/30 hover:text-violet-100"
                      title="设为参考图"
                    >
                      <ImagePlus className="size-3" />
                    </button>
                  )}
                </div>
              </>
            ) : (
              /* 骨架屏占位 */
              <div className="aspect-square w-full animate-pulse bg-white/5" />
            )}
            {/* 标签 */}
            <span className="mt-0.5 text-[10px] text-zinc-500">
              {cell.label}
            </span>
          </div>
        ))}
      </div>

      {/* 放大预览蒙层 */}
      {previewCell?.url && previewIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={handleClosePreview}
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
              <span className="text-sm text-zinc-300">
                {previewCell.label}
              </span>
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
                {onSetReference && (
                  <button
                    type="button"
                    onClick={() => onSetReference(previewCell, previewIndex)}
                    className="flex items-center gap-1 rounded-md bg-violet-500/20 px-2 py-1 text-xs text-violet-300 hover:bg-violet-500/30"
                  >
                    <ImagePlus className="size-3" /> 设为参考图
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
