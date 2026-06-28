"use client";

import { useState, useCallback } from "react";
import { Download, Maximize2, ImagePlus } from "lucide-react";

/** 单格时间推演数据 */
export interface StoryboardEvolveCell {
  /** 图片 URL，为空时显示骨架屏 */
  url?: string;
  /** 时间标签（如"3秒前"、"当前帧"） */
  label: string;
}

interface StoryboardEvolveGridProps {
  /** 4 格数据，按顺序：3秒前、当前帧、3秒后、5秒后 */
  cells: StoryboardEvolveCell[];
  /** 点击放大回调 */
  onPreview?: (cell: StoryboardEvolveCell, index: number) => void;
  /** 设为参考图回调 */
  onSetReference?: (cell: StoryboardEvolveCell, index: number) => void;
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
    window.open(url, "_blank");
  }
}

/** 默认标签 */
const DEFAULT_LABELS = ["3秒前", "当前帧", "3秒后", "5秒后"];

/**
 * 剧情推演四宫格组件
 *
 * 2×2 布局，每格标注时间标签，
 * 支持点击放大预览、下载、设为参考图。
 */
export function StoryboardEvolveGrid({
  cells,
  onPreview,
  onSetReference,
}: StoryboardEvolveGridProps) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  // 确保始终有 4 个格子
  const displayCells: StoryboardEvolveCell[] = DEFAULT_LABELS.map(
    (label, idx) => cells[idx] ?? { label },
  );

  const handlePreview = useCallback(
    (index: number) => {
      setPreviewIndex(index);
      onPreview?.(displayCells[index]!, index);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cells, onPreview],
  );

  const handleClosePreview = useCallback(() => {
    setPreviewIndex(null);
  }, []);

  const previewCell =
    previewIndex !== null ? displayCells[previewIndex] : null;

  return (
    <div className="space-y-2">
      {/* 2×2 宫格 */}
      <div className="grid grid-cols-2 gap-1.5">
        {displayCells.map((cell, idx) => (
          <div
            key={idx}
            className="group relative flex flex-col overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] transition hover:border-white/20"
          >
            {cell.url ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cell.url}
                  alt={cell.label}
                  className="aspect-video w-full object-cover"
                  loading="lazy"
                />
                {/* 时间标签 */}
                <div className="absolute left-0 top-0 rounded-br-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-zinc-200">
                  {cell.label}
                </div>
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
                      downloadImage(cell.url!, `evolve-${cell.label}.png`)
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
              <div className="flex aspect-video w-full animate-pulse flex-col items-center justify-center bg-white/5">
                <span className="text-[10px] text-zinc-600">
                  {cell.label}
                </span>
              </div>
            )}
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
              <span className="text-sm font-medium text-zinc-300">
                {previewCell.label}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadImage(
                      previewCell.url!,
                      `evolve-${previewCell.label}.png`,
                    )
                  }
                  className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs text-zinc-300 hover:bg-white/20"
                >
                  <Download className="size-3" /> 下载
                </button>
                {onSetReference && (
                  <button
                    type="button"
                    onClick={() =>
                      onSetReference(previewCell, previewIndex)
                    }
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
