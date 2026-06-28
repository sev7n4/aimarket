"use client";

import { useState, useCallback } from "react";
import { Maximize2, Download, ImagePlus, RotateCcw } from "lucide-react";

/** 单个方向图片数据 */
export interface TurnaroundAngleCell {
  /** 图片 URL，为空时显示骨架屏 */
  url?: string;
  /** 方向标签（如"正面"、"左前方"） */
  label: string;
  /** 方向英文标签 */
  labelEn: string;
}

interface Turnaround360ViewerProps {
  /** 8 个方向的图片数据 */
  angles: TurnaroundAngleCell[];
  /** 中心参考原图 URL */
  referenceUrl?: string;
  /** 点击放大回调 */
  onPreview?: (cell: TurnaroundAngleCell, index: number) => void;
  /** 设为参考图回调 */
  onSetReference?: (cell: TurnaroundAngleCell, index: number) => void;
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

/** 八角形位置角度（从正上方开始，顺时针） */
const ANGLE_POSITIONS = [
  { angle: -90,   label: "top" },         // 正面
  { angle: -45,   label: "top-right" },   // 右前方
  { angle: 0,     label: "right" },        // 右侧
  { angle: 45,    label: "bottom-right" }, // 右后方
  { angle: 90,    label: "bottom" },       // 背面
  { angle: 135,   label: "bottom-left" },  // 左后方
  { angle: 180,   label: "left" },         // 左侧
  { angle: -135,  label: "top-left" },     // 左前方
];

/**
 * 360 度角度呈现展示组件
 *
 * 8 个方向图片按八角形/圆形排列，
 * 中心显示参考原图，每个方向图片可点击放大。
 */
export function Turnaround360Viewer({
  angles,
  referenceUrl,
  onPreview,
  onSetReference,
}: Turnaround360ViewerProps) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const handlePreview = useCallback(
    (index: number) => {
      setPreviewIndex(index);
      onPreview?.(angles[index]!, index);
    },
    [angles, onPreview],
  );

  const handleClosePreview = useCallback(() => {
    setPreviewIndex(null);
  }, []);

  // 保证 angles 为 8 项
  const displayAngles = angles.length === 8
    ? angles
    : Array.from({ length: 8 }, (_, i) =>
        angles[i] ?? { label: `${i + 1}`, labelEn: "" },
      );

  // 重新排列：正面在顶部，然后顺时针（右前、右、右后、背面、左后、左、左前）
  // 对应输入顺序：0正面 1左前 2左 3左后 4背面 5右后 6右 7右前
  // 需要映射到八角形位置：top=正面(0), top-right=右前(7), right=右(6), bottom-right=右后(5),
  //                        bottom=背面(4), bottom-left=左后(3), left=左(2), top-left=左前(1)
  const indexMap = [0, 7, 6, 5, 4, 3, 2, 1]; // 从八角形 top 顺时针到输入索引

  const previewCell =
    previewIndex !== null ? displayAngles[previewIndex] : null;

  return (
    <div className="space-y-2">
      {/* 八角形/圆形布局 */}
      <div className="relative mx-auto aspect-square w-full max-w-md">
        {/* 中心参考图 */}
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          {referenceUrl ? (
            <div className="group relative size-24 overflow-hidden rounded-full border-2 border-violet-500/50 bg-white/5 shadow-lg shadow-violet-500/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={referenceUrl}
                alt="参考原图"
                className="size-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1 py-0.5 text-center">
                <span className="text-[9px] text-zinc-300">原图</span>
              </div>
            </div>
          ) : (
            <div className="flex size-24 items-center justify-center rounded-full border-2 border-dashed border-white/20 bg-white/5">
              <RotateCcw className="size-6 text-zinc-500" />
            </div>
          )}
        </div>

        {/* 8 个方向图片，圆形排列 */}
        {displayAngles.map((angle, i) => {
          // 找到该输入索引对应的八角形位置
          const posIndex = indexMap.indexOf(i);
          const pos = ANGLE_POSITIONS[posIndex] ?? ANGLE_POSITIONS[i]!;
          const radius = 42; // 百分比半径
          const rad = (pos.angle * Math.PI) / 180;
          const x = 50 + radius * Math.cos(rad);
          const y = 50 + radius * Math.sin(rad);

          return (
            <div
              key={i}
              className="group absolute z-20 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <div className="relative flex flex-col items-center">
                {angle.url ? (
                  <div className="relative size-20 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] shadow-md transition hover:border-violet-500/40 hover:shadow-violet-500/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={angle.url}
                      alt={angle.label}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                    {/* 悬浮操作栏 */}
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-gradient-to-t from-black/70 via-black/30 to-transparent py-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => handlePreview(i)}
                        className="flex size-5 items-center justify-center rounded bg-white/10 text-zinc-300 transition hover:bg-white/20 hover:text-white"
                        title="放大预览"
                      >
                        <Maximize2 className="size-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadImage(angle.url!, `turnaround-${angle.labelEn || i}.png`)
                        }
                        className="flex size-5 items-center justify-center rounded bg-white/10 text-zinc-300 transition hover:bg-white/20 hover:text-white"
                        title="下载"
                      >
                        <Download className="size-2.5" />
                      </button>
                      {onSetReference && (
                        <button
                          type="button"
                          onClick={() => onSetReference(angle, i)}
                          className="flex size-5 items-center justify-center rounded bg-violet-500/20 text-violet-300 transition hover:bg-violet-500/30 hover:text-violet-100"
                          title="设为参考图"
                        >
                          <ImagePlus className="size-2.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="size-20 animate-pulse rounded-xl border border-white/5 bg-white/5" />
                )}
                <span className="mt-0.5 text-[9px] text-zinc-500">
                  {angle.label}
                </span>
              </div>
            </div>
          );
        })}
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
                {previewCell.label} {previewCell.labelEn && `(${previewCell.labelEn})`}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadImage(
                      previewCell.url!,
                      `turnaround-${previewCell.labelEn || previewIndex}.png`,
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
