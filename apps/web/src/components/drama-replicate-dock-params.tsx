"use client";

import { Loader2 } from "lucide-react";
import type { DramaReplicateProfile } from "@/lib/types";

interface DramaReplicateDockParamsProps {
  videoUrl: string;
  profile: DramaReplicateProfile | null;
  busy?: boolean;
  disabled?: boolean;
  onVideoUrlChange: (value: string) => void;
  onAnalyze: () => void | Promise<void>;
}

export function DramaReplicateDockParams({
  videoUrl,
  profile,
  busy,
  disabled,
  onVideoUrlChange,
  onAnalyze,
}: DramaReplicateDockParamsProps) {
  return (
    <div
      className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
      data-testid="drama-replicate-dock-params"
    >
      <input
        type="url"
        value={videoUrl}
        disabled={disabled || busy}
        onChange={(e) => onVideoUrlChange(e.target.value)}
        placeholder="参考视频链接 https://..."
        className="min-w-[10rem] flex-1 rounded border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-zinc-300 placeholder:text-zinc-600 disabled:opacity-50"
        data-testid="drama-replicate-url"
      />
      <button
        type="button"
        disabled={disabled || busy || !videoUrl.trim()}
        onClick={() => void onAnalyze()}
        className="inline-flex items-center gap-1 rounded border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-[10px] text-orange-200 transition hover:bg-orange-500/20 disabled:opacity-50"
        data-testid="drama-replicate-analyze"
      >
        {busy ? <Loader2 className="size-3 animate-spin" /> : null}
        分析结构
      </button>
      {profile ? (
        <span
          className="truncate text-[10px] text-emerald-400/90"
          data-testid="drama-replicate-profile-ready"
          title={profile.beatStructure.join(" · ")}
        >
          已解析 · {profile.beatStructure.length} 节拍
        </span>
      ) : null}
    </div>
  );
}

export type DramaProductionMode = "original" | "replicate";

interface DramaProductionModeTabsProps {
  mode: DramaProductionMode;
  disabled?: boolean;
  onChange: (mode: DramaProductionMode) => void;
}

export function DramaProductionModeTabs({
  mode,
  disabled,
  onChange,
}: DramaProductionModeTabsProps) {
  return (
    <div
      className="mr-1 flex rounded-md border border-white/10 p-0.5"
      data-testid="drama-production-mode-tabs"
    >
      {(
        [
          ["original", "原创"],
          ["replicate", "复刻"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(id)}
          className={`rounded px-2 py-0.5 text-[10px] transition ${
            mode === id
              ? "bg-orange-500/20 text-orange-200"
              : "text-zinc-500 hover:text-zinc-300"
          } disabled:opacity-50`}
          data-testid={`drama-production-mode-${id}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
