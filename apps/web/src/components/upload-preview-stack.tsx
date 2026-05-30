"use client";

import { ImagePlus, Loader2, X } from "lucide-react";

export interface UploadPreviewItem {
  id: string;
  url: string;
}

interface UploadPreviewStackProps {
  items: UploadPreviewItem[];
  uploading?: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
  max?: number;
}

/** 对标椒图：上传缩略图 -15° 叠放 */
export function UploadPreviewStack({
  items,
  uploading,
  onAdd,
  onRemove,
  max = 4,
}: UploadPreviewStackProps) {
  const canAdd = items.length < max;

  return (
    <div className="relative flex h-[72px] w-[88px] shrink-0 items-center justify-center">
      {items.map((item, i) => (
        <div
          key={item.id}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-transform"
          style={{
            transform: `translate(-50%, -50%) rotate(-15deg) translateX(${i * 6}px)`,
            zIndex: i + 1,
          }}
        >
          <div className="group relative size-14 overflow-hidden rounded-lg border border-white/20 bg-zinc-900 shadow-lg shadow-black/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.url}
              alt=""
              className="size-full object-cover"
            />
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="absolute right-0.5 top-0.5 rounded-full bg-black/70 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
              aria-label="移除图片"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      ))}

      {canAdd ? (
        <button
          type="button"
          onClick={onAdd}
          disabled={uploading}
          className="relative z-10 flex size-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-white/25 bg-black/40 text-[10px] text-zinc-500 transition hover:border-orange-500/50 hover:text-zinc-300"
          style={{ transform: "rotate(-15deg)" }}
          aria-label="上传图片"
          title="上传图片"
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin text-orange-400" />
          ) : (
            <ImagePlus className="size-5" />
          )}
          <span>上传</span>
        </button>
      ) : null}
    </div>
  );
}
