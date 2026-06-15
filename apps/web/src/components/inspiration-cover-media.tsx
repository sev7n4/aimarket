"use client";

import { Clapperboard, Play } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { assetUrl } from "@/lib/api-client";
import { isVideoCoverUrl } from "@/lib/inspiration-studio";
import Image from "next/image";

interface InspirationCoverMediaProps {
  coverUrl: string;
  title: string;
  mediaType?: "image" | "video";
  videoUrl?: string;
  fill?: boolean;
  className?: string;
  sizes?: string;
  objectFit?: "cover" | "contain";
  /** 详情页：显示原生 controls，点击即可播放 */
  interactive?: boolean;
}

/** 灵感封面：图片直接展示；视频用 poster + 点击/悬停预览 */
export function InspirationCoverMedia({
  coverUrl,
  title,
  mediaType,
  videoUrl,
  fill = true,
  className = "object-cover",
  sizes,
  objectFit = "cover",
  interactive = false,
}: InspirationCoverMediaProps) {
  const isVideo =
    mediaType === "video" || isVideoCoverUrl(coverUrl) || Boolean(videoUrl);
  const posterIsImage = coverUrl && !isVideoCoverUrl(coverUrl);
  const playbackUrl = videoUrl ?? (isVideoCoverUrl(coverUrl) ? coverUrl : "");
  const posterSrc = posterIsImage
    ? coverUrl.startsWith("http")
      ? coverUrl
      : assetUrl(coverUrl)
    : "";
  const videoSrc = playbackUrl
    ? playbackUrl.startsWith("http")
      ? playbackUrl
      : assetUrl(playbackUrl)
    : "";

  const [playing, setPlaying] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startPlay = useCallback(() => {
    if (!videoSrc || videoFailed) return;
    const el = videoRef.current;
    if (!el) return;
    void el.play()
      .then(() => setPlaying(true))
      .catch(() => setVideoFailed(true));
  }, [videoFailed, videoSrc]);

  const stopPlay = useCallback(() => {
    const el = videoRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setPlaying(false);
  }, []);

  const onEnter = useCallback(() => {
    if (interactive || !videoSrc || videoFailed) return;
    startPlay();
  }, [interactive, startPlay, videoFailed, videoSrc]);

  const onLeave = useCallback(() => {
    if (interactive) return;
    stopPlay();
  }, [interactive, stopPlay]);

  const onTogglePlay = useCallback(() => {
    if (!videoSrc || videoFailed) return;
    if (playing) stopPlay();
    else startPlay();
  }, [playing, startPlay, stopPlay, videoFailed, videoSrc]);

  if (!isVideo) {
    if (!coverUrl) {
      return (
        <div
          className={`flex items-center justify-center bg-zinc-900 text-zinc-600 ${
            fill ? "absolute inset-0 h-full w-full" : "h-full w-full"
          }`}
        >
          <Clapperboard className="size-8 opacity-40" aria-hidden />
        </div>
      );
    }
    if (fill) {
      return (
        <Image
          src={coverUrl}
          alt={title}
          fill
          sizes={sizes}
          className={className}
          unoptimized
        />
      );
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={coverUrl} alt={title} className={`h-full w-full ${className}`} />
    );
  }

  if (!posterSrc && !videoSrc) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1 bg-zinc-900 text-zinc-500 ${
          fill ? "absolute inset-0 h-full w-full" : "h-full w-full"
        }`}
      >
        <Clapperboard className="size-8 opacity-50" aria-hidden />
        <span className="text-[10px]">视频预览不可用</span>
      </div>
    );
  }

  const layoutClass = fill
    ? "absolute inset-0 h-full w-full"
    : "h-full w-full";

  return (
    <div
      className={`${layoutClass} relative overflow-hidden`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={interactive ? onTogglePlay : undefined}
      role={interactive && videoSrc ? "button" : undefined}
      tabIndex={interactive && videoSrc ? 0 : undefined}
      onKeyDown={
        interactive && videoSrc
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onTogglePlay();
              }
            }
          : undefined
      }
    >
      {posterSrc ? (
        <Image
          src={posterSrc}
          alt={title}
          fill={fill}
          sizes={sizes}
          className={`${className} transition ${
            playing && videoSrc && !videoFailed ? "opacity-0" : "opacity-100"
          }`}
          unoptimized
        />
      ) : null}
      {videoSrc && !videoFailed ? (
        <video
          ref={videoRef}
          src={videoSrc}
          className={`${layoutClass} ${className}`}
          style={{ objectFit }}
          muted={!interactive}
          loop={!interactive}
          playsInline
          controls={interactive}
          preload="metadata"
          aria-label={title}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => setVideoFailed(true)}
        />
      ) : null}
      {!posterSrc && (videoFailed || !videoSrc) ? (
        <div className={`${layoutClass} flex items-center justify-center bg-zinc-900`}>
          <Clapperboard className="size-8 text-zinc-600" aria-hidden />
        </div>
      ) : null}
      {videoSrc && !videoFailed && !playing && !interactive ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
          <span className="flex size-9 items-center justify-center rounded-full bg-black/50 text-white">
            <Play className="ml-0.5 size-4" fill="currentColor" />
          </span>
        </div>
      ) : null}
      <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/55 px-1.5 py-0.5 text-[9px] text-zinc-200">
        视频
      </div>
    </div>
  );
}
