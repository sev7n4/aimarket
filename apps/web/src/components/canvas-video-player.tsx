"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { assetUrl } from "@/lib/api-client";

interface CanvasVideoPlayerProps {
  url: string;
  /** 选中态：展示播放控件与渐变遮罩 */
  active?: boolean;
  className?: string;
}

/**
 * 画布内视频缩略图：对标极梦视频成果 — 单击播放/暂停，非图片精修工具链。
 */
export function CanvasVideoPlayer({
  url,
  active = false,
  className = "",
}: CanvasVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const togglePlay = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      const el = videoRef.current;
      if (!el) return;
      if (el.paused) {
        void el.play();
      } else {
        el.pause();
      }
    },
    [],
  );

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, []);

  useEffect(() => {
    if (!active) {
      videoRef.current?.pause();
    }
  }, [active]);

  return (
    <div
      className={`relative h-full w-full bg-black ${className}`}
      data-testid="canvas-video-player"
    >
      <video
        ref={videoRef}
        src={assetUrl(url)}
        className="pointer-events-none h-full w-full object-cover"
        playsInline
        preload="metadata"
        loop
        muted
      />
      <button
        type="button"
        aria-label={playing ? "暂停视频" : "播放视频"}
        data-testid="canvas-video-play-toggle"
        className={`absolute inset-0 flex items-center justify-center transition ${
          playing && active
            ? "bg-black/0 opacity-0 hover:opacity-100 hover:bg-black/25"
            : "bg-black/20"
        }`}
        onClick={togglePlay}
      >
        <span
          className={`flex size-11 items-center justify-center rounded-full border border-white/30 bg-black/55 text-white shadow-lg backdrop-blur-sm transition ${
            active ? "scale-100" : "scale-90 opacity-90"
          }`}
        >
          {playing && active ? (
            <Pause className="size-5" fill="currentColor" />
          ) : (
            <Play className="size-5 translate-x-0.5" fill="currentColor" />
          )}
        </span>
      </button>
      {playing && active ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/60 to-transparent" />
      ) : null}
    </div>
  );
}
