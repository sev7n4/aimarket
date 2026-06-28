"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@aimarket/ui";
import { Loader2, Music, Pause, Play } from "lucide-react";

export interface MusicGenResult {
  audioUrl: string;
  durationSec: number;
}

interface MusicGenPanelProps {
  /** 提交音乐生成请求 */
  onGenerate: (params: { style: string; bpm: number; durationSec: number }) => Promise<MusicGenResult>;
}

/**
 * AI 音乐生成面板
 * - 风格描述输入框
 * - BPM 滑块（60-200，默认 120）
 * - 时长选择（30秒/60秒）
 * - 生成按钮
 * - 生成中状态 + 结果预览播放器
 */
export function MusicGenPanel({ onGenerate }: MusicGenPanelProps) {
  const [style, setStyle] = useState("");
  const [bpm, setBpm] = useState(120);
  const [durationSec, setDurationSec] = useState(30);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<MusicGenResult | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleGenerate = useCallback(async () => {
    if (!style.trim() || generating) return;
    setGenerating(true);
    setResult(null);
    setPlaying(false);
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

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  }, [playing]);

  const handleAudioEnded = useCallback(() => {
    setPlaying(false);
  }, []);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* 风格描述 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-white/70">风格描述</label>
        <input
          type="text"
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30"
          placeholder="例如：轻快电子乐、忧伤钢琴、激昂交响乐"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
        />
      </div>

      {/* BPM 滑块 */}
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

      {/* 时长选择 */}
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

      {/* 生成按钮 */}
      <Button
        className="w-full"
        onClick={handleGenerate}
        disabled={!style.trim() || generating}
      >
        {generating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            生成中…
          </>
        ) : (
          <>
            <Music className="w-4 h-4 mr-2" />
            生成音乐
          </>
        )}
      </Button>

      {/* 结果预览播放器 */}
      {result && (
        <div className="flex flex-col gap-2 rounded-lg bg-white/5 border border-white/10 p-3">
          <div className="flex items-center gap-3">
            <button
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              onClick={togglePlay}
            >
              {playing ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white ml-0.5" />
              )}
            </button>
            <div className="flex flex-col">
              <span className="text-sm text-white/80">{style}</span>
              <span className="text-xs text-white/40">
                {bpm} BPM · {result.durationSec}s
              </span>
            </div>
          </div>
          <audio
            ref={audioRef}
            src={result.audioUrl}
            onEnded={handleAudioEnded}
          />
        </div>
      )}
    </div>
  );
}
