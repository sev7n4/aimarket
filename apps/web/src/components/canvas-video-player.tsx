"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { assetUrl } from "@/lib/api-client";

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface CanvasVideoPlayerProps {
  url: string;
  active?: boolean;
  className?: string;
}

/**
 * 画布内视频播放器：播放/暂停、进度条、音量（用户手势后取消静音）。
 */
export function CanvasVideoPlayer({
  url,
  active = false,
  className = "",
}: CanvasVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      if (muted) {
        el.muted = false;
        setMuted(false);
      }
      void el.play();
    } else {
      el.pause();
    }
  }, [muted]);

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    const next = !el.muted;
    el.muted = next;
    setMuted(next);
  }, []);

  const onSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    const t = Number(e.target.value);
    el.currentTime = t;
    setCurrentTime(t);
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    const onTime = () => setCurrentTime(el.currentTime);
    const onMeta = () => setDuration(el.duration || 0);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onMeta);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onMeta);
    };
  }, []);

  useEffect(() => {
    if (!active) {
      const el = videoRef.current;
      el?.pause();
      if (el) {
        el.muted = true;
        setMuted(true);
      }
      setPlaying(false);
    }
  }, [active]);

  const showControls = active && (playing || currentTime > 0);

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
        muted={muted}
      />
      <button
        type="button"
        aria-label={playing ? "暂停视频" : "播放视频"}
        data-testid="canvas-video-play-toggle"
        className={`absolute inset-0 flex items-center justify-center transition ${
          playing && active
            ? "bg-black/0 opacity-0 hover:opacity-100 hover:bg-black/20"
            : "bg-black/20"
        } ${showControls ? "bottom-10" : ""}`}
        onClick={togglePlay}
      >
        {!showControls ? (
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
        ) : null}
      </button>
      {showControls ? (
        <div
          className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-1.5 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-4"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label={muted ? "取消静音" : "静音"}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-white/90 hover:bg-white/10"
            onClick={toggleMute}
          >
            {muted ? (
              <VolumeX className="size-3.5" />
            ) : (
              <Volume2 className="size-3.5" />
            )}
          </button>
          <span className="shrink-0 text-[10px] tabular-nums text-white/70">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            onChange={onSeek}
            className="min-w-0 flex-1 accent-orange-500"
            aria-label="播放进度"
            data-testid="canvas-video-progress"
          />
          <span className="shrink-0 text-[10px] tabular-nums text-white/50">
            {formatTime(duration)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
