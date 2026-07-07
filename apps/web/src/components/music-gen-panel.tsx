"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Button } from "@aimarket/ui";
import {
  ChevronRight,
  Loader2,
  Music,
  Pause,
  Play,
  X,
} from "lucide-react";

import { canvasTheme } from "@/components/infinite-canvas/canvas-theme";
import { assetUrl, fetchJob, generateMusic } from "@/lib/api-client";

export interface MusicGenResult {
  audioUrl: string;
  durationSec: number;
}

type MusicGenParams = {
  style: string;
  bpm: number;
  durationSec: number;
};

type MusicGenEmbeddedProps = {
  variant?: "embedded";
  onGenerate: (params: MusicGenParams) => Promise<MusicGenResult>;
};

type MusicGenSidebarProps = {
  variant: "sidebar";
  sessionId?: string;
  onClose?: () => void;
  initialCollapsed?: boolean;
  onMusicGenerated?: (audioUrl: string) => void;
};

export type MusicGenPanelProps = MusicGenEmbeddedProps | MusicGenSidebarProps;

function useAudioPlayback(audioSrc: string | null) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play();
      setPlaying(true);
    }
  }, [playing, audioSrc]);

  useEffect(() => {
    setPlaying(false);
  }, [audioSrc]);

  const handleAudioEnded = useCallback(() => {
    setPlaying(false);
  }, []);

  return { audioRef, playing, togglePlay, handleAudioEnded };
}

function MusicGenPlayer({
  style,
  bpm,
  durationSec,
  audioUrl,
  variant,
  playing,
  onTogglePlay,
  onAudioEnded,
  audioRef,
}: {
  style: string;
  bpm: number;
  durationSec: number;
  audioUrl: string;
  variant: "embedded" | "sidebar";
  playing: boolean;
  onTogglePlay: () => void;
  onAudioEnded: () => void;
  audioRef: RefObject<HTMLAudioElement | null>;
}) {
  if (variant === "sidebar") {
    return (
      <div
        className="mt-3 flex flex-col gap-2 rounded-lg border p-2.5"
        style={{
          borderColor: canvasTheme.node.stroke,
          background: canvasTheme.node.fill,
        }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlay}
            className="inline-flex size-8 items-center justify-center rounded-full transition hover:scale-105"
            style={{
              background: canvasTheme.toolbar.activeBg,
              color: canvasTheme.toolbar.activeText,
            }}
            aria-label={playing ? "暂停" : "播放"}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <div className="flex flex-col">
            <span
              className="text-[11px] font-medium"
              style={{ color: canvasTheme.node.text }}
            >
              {style}
            </span>
            <span
              className="text-[10px]"
              style={{ color: canvasTheme.node.faint }}
            >
              {bpm} BPM · {durationSec}s
            </span>
          </div>
        </div>
        <audio ref={audioRef} src={audioUrl} preload="auto" onEnded={onAudioEnded} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex size-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          onClick={onTogglePlay}
        >
          {playing ? (
            <Pause className="size-5 text-white" />
          ) : (
            <Play className="ml-0.5 size-5 text-white" />
          )}
        </button>
        <div className="flex flex-col">
          <span className="text-sm text-white/80">{style}</span>
          <span className="text-xs text-white/40">
            {bpm} BPM · {durationSec}s
          </span>
        </div>
      </div>
      <audio ref={audioRef} src={audioUrl} onEnded={onAudioEnded} />
    </div>
  );
}

function MusicGenEmbeddedPanel({
  onGenerate,
}: MusicGenEmbeddedProps) {
  const [style, setStyle] = useState("");
  const [bpm, setBpm] = useState(120);
  const [durationSec, setDurationSec] = useState(30);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<MusicGenResult | null>(null);
  const { audioRef, playing, togglePlay, handleAudioEnded } = useAudioPlayback(
    result?.audioUrl ?? null,
  );

  const handleGenerate = useCallback(async () => {
    if (!style.trim() || generating) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await onGenerate({
        style: style.trim(),
        bpm,
        durationSec,
      });
      setResult(res);
    } finally {
      setGenerating(false);
    }
  }, [style, bpm, durationSec, generating, onGenerate]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-white/70">风格描述</label>
        <input
          type="text"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
          placeholder="例如：轻快电子乐、忧伤钢琴、激昂交响乐"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm text-white/70">BPM（节拍速度）</label>
          <span className="text-sm text-white/50">{bpm}</span>
        </div>
        <input
          type="range"
          min={60}
          max={200}
          step={1}
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-white/30">
          <span>慢 60</span>
          <span>快 200</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-white/70">时长</label>
        <div className="flex gap-2">
          <Button
            variant={durationSec === 30 ? "primary" : "ghost"}
            className="px-3 py-1 text-xs"
            onClick={() => setDurationSec(30)}
          >
            30 秒
          </Button>
          <Button
            variant={durationSec === 60 ? "primary" : "ghost"}
            className="px-3 py-1 text-xs"
            onClick={() => setDurationSec(60)}
          >
            60 秒
          </Button>
        </div>
      </div>

      <Button
        className="w-full"
        onClick={handleGenerate}
        disabled={!style.trim() || generating}
      >
        {generating ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            生成中…
          </>
        ) : (
          <>
            <Music className="mr-2 size-4" />
            生成音乐
          </>
        )}
      </Button>

      {result ? (
        <MusicGenPlayer
          style={style}
          bpm={bpm}
          durationSec={result.durationSec}
          audioUrl={result.audioUrl}
          variant="embedded"
          playing={playing}
          onTogglePlay={togglePlay}
          onAudioEnded={handleAudioEnded}
          audioRef={audioRef}
        />
      ) : null}
    </div>
  );
}

function MusicGenSidebarPanel({
  sessionId,
  onClose,
  initialCollapsed = false,
  onMusicGenerated,
}: Omit<MusicGenSidebarProps, "variant">) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [style, setStyle] = useState("轻快电子乐");
  const [bpm, setBpm] = useState(120);
  const [durationSec, setDurationSec] = useState(30);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const { audioRef, playing, togglePlay, handleAudioEnded } = useAudioPlayback(
    audioUrl ? assetUrl(audioUrl) : null,
  );

  useEffect(() => {
    if (!jobId || !generating) return;
    let stopped = false;
    const poll = async () => {
      while (!stopped && generating) {
        try {
          const job = await fetchJob(jobId);
          if (job.status === "succeeded") {
            const url = job.outputs?.[0]?.url;
            if (url) {
              setAudioUrl(url);
              onMusicGenerated?.(url);
            }
            setGenerating(false);
            setJobId(null);
            return;
          }
          if (job.status === "failed") {
            setError(job.error ?? "音乐生成失败");
            setGenerating(false);
            setJobId(null);
            return;
          }
        } catch {
          /* 忽略轮询错误，继续重试 */
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    };
    void poll();
    return () => {
      stopped = true;
    };
  }, [jobId, generating, onMusicGenerated]);

  const handleGenerate = useCallback(async () => {
    if (!sessionId) {
      setError("缺少会话 ID，无法生成音乐");
      return;
    }
    setError(null);
    setGenerating(true);
    setAudioUrl(null);
    try {
      const result = await generateMusic({
        sessionId,
        style,
        bpm,
        durationSec,
      });
      setJobId(result.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "音乐生成请求失败");
      setGenerating(false);
    }
  }, [sessionId, style, bpm, durationSec]);

  if (collapsed) {
    return (
      <div
        className="flex w-10 shrink-0 flex-col items-center gap-2 border-l py-3"
        style={{
          background: canvasTheme.canvas.background,
          borderColor: canvasTheme.node.stroke,
        }}
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded p-1 transition hover:bg-white/10"
          aria-label="展开音乐生成"
          title="AI 音乐生成"
        >
          <Music className="size-4" style={{ color: canvasTheme.node.muted }} />
        </button>
        <span
          className="text-[10px]"
          style={{ color: canvasTheme.node.faint, writingMode: "vertical-rl" }}
        >
          音乐
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex h-full w-[300px] shrink-0 flex-col border-l"
      style={{
        background: canvasTheme.canvas.background,
        borderColor: canvasTheme.node.stroke,
      }}
      data-testid="music-gen-panel"
    >
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: canvasTheme.node.stroke }}
      >
        <div className="flex items-center gap-2">
          <Music className="size-3.5" style={{ color: canvasTheme.node.muted }} />
          <span
            className="text-xs font-semibold"
            style={{ color: canvasTheme.node.text }}
          >
            AI 音乐生成
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="rounded p-0.5 transition hover:bg-white/10"
            aria-label="收起面板"
            title="收起"
          >
            <ChevronRight
              className="size-3.5"
              style={{ color: canvasTheme.node.faint }}
            />
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded p-0.5 transition hover:bg-white/10"
              aria-label="关闭面板"
            >
              <X className="size-3.5" style={{ color: canvasTheme.node.faint }} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {error ? (
          <div
            className="mb-3 rounded-md border px-2.5 py-1.5 text-[11px]"
            style={{
              borderColor: "rgba(239,68,68,0.4)",
              background: "rgba(239,68,68,0.1)",
              color: "#fca5a5",
            }}
          >
            {error}
          </div>
        ) : null}

        <div className="mb-3 flex flex-col gap-1">
          <label
            className="text-[11px] font-medium"
            style={{ color: canvasTheme.node.faint }}
          >
            风格描述
          </label>
          <input
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            placeholder="例如：忧伤钢琴、轻快电子乐、摇滚"
            className="w-full rounded border bg-transparent px-2 py-1.5 text-xs outline-none focus:ring-1"
            style={{
              borderColor: canvasTheme.node.stroke,
              color: canvasTheme.node.text,
            }}
          />
        </div>

        <div className="mb-3 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label
              className="text-[11px] font-medium"
              style={{ color: canvasTheme.node.faint }}
            >
              节拍速度（BPM）
            </label>
            <span
              className="font-mono text-[11px]"
              style={{ color: canvasTheme.node.muted }}
            >
              {bpm}
            </span>
          </div>
          <input
            type="range"
            min={60}
            max={200}
            step={1}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
          <div
            className="flex justify-between text-[9px]"
            style={{ color: canvasTheme.node.faint }}
          >
            <span>60 慢速</span>
            <span>200 快速</span>
          </div>
        </div>

        <div className="mb-3 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label
              className="text-[11px] font-medium"
              style={{ color: canvasTheme.node.faint }}
            >
              时长（秒）
            </label>
            <span
              className="font-mono text-[11px]"
              style={{ color: canvasTheme.node.muted }}
            >
              {durationSec}s
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={120}
            step={5}
            value={durationSec}
            onChange={(e) => setDurationSec(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
          <div
            className="flex justify-between text-[9px]"
            style={{ color: canvasTheme.node.faint }}
          >
            <span>10s</span>
            <span>120s</span>
          </div>
        </div>

        <button
          type="button"
          disabled={generating || !sessionId}
          onClick={handleGenerate}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition disabled:opacity-50"
          style={{
            background: canvasTheme.toolbar.activeBg,
            color: canvasTheme.toolbar.activeText,
          }}
        >
          {generating ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              生成中…
            </>
          ) : (
            <>
              <Music className="size-3.5" />
              生成音乐
            </>
          )}
        </button>

        {audioUrl ? (
          <MusicGenPlayer
            style={style}
            bpm={bpm}
            durationSec={durationSec}
            audioUrl={assetUrl(audioUrl)}
            variant="sidebar"
            playing={playing}
            onTogglePlay={togglePlay}
            onAudioEnded={handleAudioEnded}
            audioRef={audioRef}
          />
        ) : null}
      </div>
    </div>
  );
}

/** AI 音乐生成面板：`embedded` 回调模式 / `sidebar` Infinite 画布侧栏 */
export function MusicGenPanel(props: MusicGenPanelProps) {
  if (props.variant === "sidebar") {
    return <MusicGenSidebarPanel {...props} />;
  }
  return <MusicGenEmbeddedPanel {...props} />;
}
