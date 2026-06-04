"use client";

import { useMemo, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { assetUrl } from "@/lib/api-client";

export interface UploadPreviewItem {
  id: string;
  url: string;
}

interface UploadPreviewStackProps {
  items: UploadPreviewItem[];
  uploading?: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onPreview?: (index: number) => void;
  max?: number;
}

/** 对标椒图：上传缩略图 -15° 叠放 */
export function UploadPreviewStack({
  items,
  uploading,
  onAdd,
  onRemove,
  onPreview,
  max = 4,
}: UploadPreviewStackProps) {
  const canAdd = items.length < max;
  const [expanded, setExpanded] = useState(false);
  const spread = useMemo(() => {
    if (!expanded || items.length <= 1) return 6;
    return 42;
  }, [expanded, items.length]);
  const addButtonOffset = items.length
    ? expanded
      ? ((items.length - 1) / 2 + 1) * spread
      : 48 + (items.length - 1) * spread
    : 0;

  return (
    <div
      className="relative flex h-[72px] w-[168px] shrink-0 items-center justify-center"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {items.map((item, i) => (
        <div
          key={item.id}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-200"
          style={{
            transform: `translate(-50%, -50%) rotate(${expanded ? 0 : -15}deg) translateX(${
              expanded
                ? (i - (items.length - 1) / 2) * spread
                : i * spread
            }px)`,
            zIndex: expanded ? i + 20 : i + 10,
          }}
        >
          <button
            type="button"
            onClick={() => onPreview?.(i)}
            data-testid={`upload-preview-card-${i}`}
            className="group relative block size-14 overflow-hidden rounded-lg border border-white/20 bg-zinc-900 shadow-lg shadow-black/50"
            title="预览图片"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                item.url.startsWith("http") || item.url.startsWith("blob:")
                  ? item.url
                  : assetUrl(item.url)
              }
              alt=""
              className="size-full object-cover"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(item.id);
              }}
              className="absolute right-0.5 top-0.5 rounded-full bg-black/70 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
              aria-label="移除图片"
            >
              <X className="size-3" />
            </button>
          </button>
        </div>
      ))}

      {canAdd ? (
        <button
          type="button"
          onClick={onAdd}
          disabled={uploading}
          data-testid="upload-preview-add"
          className="absolute left-1/2 top-1/2 z-[1] flex size-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-white/25 bg-black/40 text-[10px] text-zinc-500 transition hover:border-orange-500/50 hover:text-zinc-300"
          style={{
            transform:
              `translate(-50%, -50%) rotate(${expanded ? 0 : -15}deg) ` +
              `translateX(${addButtonOffset}px)`,
          }}
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
