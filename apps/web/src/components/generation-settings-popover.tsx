"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import type { CreationMode } from "@aimarket/ui";

/** 对齐椒图 / Gemini 图片常见比例 */
export type AspectRatio =
  | "1:1"
  | "4:3"
  | "3:4"
  | "16:9"
  | "9:16"
  | "3:2"
  | "2:3"
  | "4:5"
  | "5:4"
  | "21:9";

const aspects: { id: AspectRatio; label: string }[] = [
  { id: "1:1", label: "1:1" },
  { id: "4:3", label: "4:3" },
  { id: "3:4", label: "3:4" },
  { id: "3:2", label: "3:2" },
  { id: "2:3", label: "2:3" },
  { id: "16:9", label: "16:9" },
  { id: "9:16", label: "9:16" },
  { id: "4:5", label: "4:5" },
  { id: "5:4", label: "5:4" },
  { id: "21:9", label: "21:9" },
];

const resolutions = [
  { id: "1k", label: "1K" },
  { id: "2k", label: "2K" },
  { id: "4k", label: "4K" },
] as const;

interface GenerationSettingsPopoverProps {
  mode: CreationMode;
  resolution: string;
  aspectRatio: AspectRatio;
  onResolutionChange: (v: string) => void;
  onAspectRatioChange: (v: AspectRatio) => void;
  videoMode?: boolean;
}

export function GenerationSettingsPopover({
  mode,
  resolution,
  aspectRatio,
  onResolutionChange,
  onAspectRatioChange,
  videoMode,
}: GenerationSettingsPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const smartLabel = mode === "quick" ? "智能" : "标准";
  const resOptions = videoMode
    ? resolutions.filter((r) => r.id !== "4k")
    : resolutions;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex max-w-[9.5rem] items-center gap-1 truncate rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/10 sm:max-w-none"
      >
        <Sparkles className="size-3 shrink-0 text-orange-400" />
        <span className="truncate">
          {smartLabel} · {aspectRatio} · {resolution.toUpperCase()}
        </span>
        <ChevronDown
          className={`size-3 shrink-0 opacity-60 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-2xl border border-white/10 bg-[#1a1a1a] p-3 shadow-xl">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            生成比例
          </p>
          <div className="grid max-h-40 grid-cols-5 gap-1.5 overflow-y-auto">
            {aspects.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onAspectRatioChange(a.id)}
                className={`rounded-lg px-1.5 py-1.5 text-[11px] transition ${
                  aspectRatio === a.id
                    ? "bg-white text-black"
                    : "bg-white/5 text-zinc-400 hover:bg-white/10"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
          <p className="mb-2 mt-3 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            分辨率
          </p>
          <div className="flex gap-1.5">
            {resOptions.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onResolutionChange(r.id);
                  setOpen(false);
                }}
                className={`flex-1 rounded-lg py-1.5 text-xs transition ${
                  resolution === r.id
                    ? "bg-orange-500 text-white"
                    : "bg-white/5 text-zinc-400 hover:bg-white/10"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
