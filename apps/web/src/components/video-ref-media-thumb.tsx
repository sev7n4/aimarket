"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Mic, Play, Video, X } from "lucide-react";
import { assetUrl } from "@/lib/api-client";
import { inferMediaTypeFromUrl } from "@/lib/video-ref-media";
import type { VideoMediaType } from "@/lib/creation-dock-prefs";

function resolveSrc(url: string): string {
  if (
    url.startsWith("http") ||
    url.startsWith("blob:") ||
    url.startsWith("data:")
  ) {
    return url;
  }
  return assetUrl(url);
}

export interface VideoRefMediaThumbProps {
  previewUrl: string;
  mediaType?: VideoMediaType;
  label?: string;
  sizeClass?: string;
  ringClass?: string;
  disabled?: boolean;
  /** 点击缩略图打开预览/播放 */
  previewable?: boolean;
  /** 若提供，主区域点击执行选用（如从画布挑选进槽位），角标按钮仍可预览 */
  onSelect?: () => void;
  className?: string;
}

/** 视频参考槽位：按图/音/视展示缩略图，点击可预览或播放 */
export function VideoRefMediaThumb({
  previewUrl,
  mediaType: mediaTypeProp,
  label,
  sizeClass = "size-12",
  ringClass = "ring-1 ring-white/10",
  disabled = false,
  previewable = true,
  onSelect,
  className = "",
}: VideoRefMediaThumbProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const mediaType = mediaTypeProp ?? inferMediaTypeFromUrl(previewUrl);
  const src = resolveSrc(previewUrl);

  const openPreview = useCallback(() => {
    if (!disabled && previewable) setPreviewOpen(true);
  }, [disabled, previewable]);

  const thumbClass = `relative shrink-0 overflow-hidden rounded-lg ${sizeClass} ${ringClass} ${className} ${
    !disabled && (previewable || onSelect)
      ? "cursor-pointer transition hover:ring-sky-500/50"
      : ""
  }`;

  const showPlayOverlay = mediaType !== "image" && (previewable || onSelect);

  const thumbBody = (
    <>
      <ThumbContent mediaType={mediaType} src={src} sizeClass={sizeClass} />
      {showPlayOverlay ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
          {mediaType === "video" ? (
            <Play className="size-4 text-white" fill="currentColor" />
          ) : (
            <Mic className="size-3.5 text-white" />
          )}
        </span>
      ) : null}
      {mediaType !== "image" ? (
        <span className="pointer-events-none absolute bottom-0 right-0 rounded-tl-md bg-black/65 px-0.5 text-[7px] text-zinc-200">
          {mediaType === "video" ? "视频" : "音频"}
        </span>
      ) : null}
    </>
  );

  const previewDialog =
    previewOpen && previewable ? (
      <VideoRefMediaPreviewDialog
        src={src}
        mediaType={mediaType}
        label={label}
        onClose={() => setPreviewOpen(false)}
      />
    ) : null;

  if (onSelect) {
    return (
      <>
        <div className={thumbClass}>
          <button
            type="button"
            disabled={disabled}
            onClick={onSelect}
            title={label ?? "选用"}
            aria-label={label ?? "选用素材"}
            className="absolute inset-0 z-0 size-full"
          >
            <span className="sr-only">{label ?? "选用"}</span>
            {thumbBody}
          </button>
          {previewable && !disabled ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openPreview();
              }}
              title="预览"
              aria-label={`预览${mediaType === "image" ? "图片" : mediaType === "video" ? "视频" : "音频"}`}
              className="absolute right-0 top-0 z-10 rounded-bl-md bg-black/70 p-0.5 text-zinc-200 hover:bg-black/90"
            >
              <Eye className="size-2.5" />
            </button>
          ) : null}
        </div>
        {previewDialog}
      </>
    );
  }

  return (
    <>
      {previewable ? (
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            openPreview();
          }}
          title={label ?? "预览"}
          aria-label={
            label ??
            `预览${mediaType === "image" ? "图片" : mediaType === "video" ? "视频" : "音频"}`
          }
          className={thumbClass}
        >
          {thumbBody}
        </button>
      ) : (
        <div className={thumbClass} aria-hidden>
          {thumbBody}
        </div>
      )}
      {previewDialog}
    </>
  );
}

function ThumbContent({
  mediaType,
  src,
  sizeClass,
}: {
  mediaType: VideoMediaType;
  src: string;
  sizeClass: string;
}) {
  if (mediaType === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className={`${sizeClass} object-cover`} />
    );
  }
  if (mediaType === "video") {
    return (
      <video
        src={src}
        className={`${sizeClass} object-cover bg-zinc-900`}
        muted
        playsInline
        preload="metadata"
        aria-hidden
      />
    );
  }
  return (
    <div
      className={`${sizeClass} flex flex-col items-center justify-center gap-0.5 bg-gradient-to-br from-violet-950/80 to-zinc-900 text-violet-200/90`}
    >
      <Mic className="size-4" />
      <Video className="size-2.5 opacity-40" aria-hidden />
    </div>
  );
}

function VideoRefMediaPreviewDialog({
  src,
  mediaType,
  label,
  onClose,
}: {
  src: string;
  mediaType: VideoMediaType;
  label?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-label={label ?? "媒体预览"}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-zinc-200 hover:bg-black/80"
        aria-label="关闭预览"
      >
        <X className="size-5" />
      </button>
      <div
        className="max-h-[85vh] max-w-[min(92vw,720px)]"
        onClick={(e) => e.stopPropagation()}
      >
        {mediaType === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={label ?? ""}
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
          />
        ) : mediaType === "video" ? (
          <video
            src={src}
            className="max-h-[85vh] max-w-full rounded-lg bg-black"
            controls
            autoPlay
            playsInline
          />
        ) : (
          <div className="flex min-w-[min(80vw,360px)] flex-col items-center gap-3 rounded-xl bg-zinc-900 p-6 ring-1 ring-white/10">
            <Mic className="size-10 text-violet-300" />
            {label ? (
              <p className="text-sm text-zinc-300">{label}</p>
            ) : null}
            <audio src={src} controls autoPlay className="w-full" />
          </div>
        )}
      </div>
    </div>
  );
}
