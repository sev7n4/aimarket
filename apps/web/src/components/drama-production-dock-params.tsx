"use client";

export const DRAMA_DURATION_OPTIONS = [60, 90, 120, 180] as const;
export type DramaAspectRatio = "9:16" | "16:9";

interface DramaProductionDockParamsProps {
  targetDurationSec: number;
  aspectRatio: DramaAspectRatio;
  onTargetDurationSecChange: (value: number) => void;
  onAspectRatioChange: (value: DramaAspectRatio) => void;
  disabled?: boolean;
}

export function DramaProductionDockParams({
  targetDurationSec,
  aspectRatio,
  onTargetDurationSecChange,
  onAspectRatioChange,
  disabled,
}: DramaProductionDockParamsProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      data-testid="drama-production-dock-params"
    >
      <label className="flex items-center gap-1 text-[10px] text-zinc-500">
        <span className="shrink-0">时长</span>
        <select
          value={targetDurationSec}
          disabled={disabled}
          onChange={(e) =>
            onTargetDurationSecChange(Number(e.target.value))
          }
          className="rounded border border-white/10 bg-black/30 px-1 py-0.5 text-[10px] text-zinc-300 disabled:opacity-50"
          data-testid="drama-target-duration"
        >
          {DRAMA_DURATION_OPTIONS.map((sec) => (
            <option key={sec} value={sec}>
              {sec}s
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1 text-[10px] text-zinc-500">
        <span className="shrink-0">画幅</span>
        <select
          value={aspectRatio}
          disabled={disabled}
          onChange={(e) =>
            onAspectRatioChange(e.target.value as DramaAspectRatio)
          }
          className="rounded border border-white/10 bg-black/30 px-1 py-0.5 text-[10px] text-zinc-300 disabled:opacity-50"
          data-testid="drama-aspect-ratio"
        >
          <option value="9:16">9:16 竖屏</option>
          <option value="16:9">16:9 横屏</option>
        </select>
      </label>
    </div>
  );
}
