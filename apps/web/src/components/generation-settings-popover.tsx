"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import type { CreationMode } from "@aimarket/ui";
import { CompactDockSheet } from "@/components/compact-dock-sheet";
import { AspectRatioPreview } from "@/components/aspect-ratio-preview";

/** 对齐椒图：智能 + 常见比例（含线框示意） */
export type AspectRatio =
  | "auto"
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

const aspects: { id: AspectRatio; label: string; smart?: boolean }[] = [
  { id: "auto", label: "智能", smart: true },
  { id: "1:1", label: "1:1" },
  { id: "2:3", label: "2:3" },
  { id: "3:2", label: "3:2" },
  { id: "3:4", label: "3:4" },
  { id: "4:3", label: "4:3" },
  { id: "9:16", label: "9:16" },
  { id: "16:9", label: "16:9" },
  { id: "4:5", label: "4:5" },
  { id: "5:4", label: "5:4" },
  { id: "21:9", label: "21:9" },
];

const resolutions = [
  { id: "1k", label: "1K" },
  { id: "2k", label: "2K" },
  { id: "4k", label: "4K" },
] as const;

function aspectTriggerLabel(ratio: AspectRatio, resolution: string) {
  const ratioLabel = ratio === "auto" ? "智能" : ratio;
  return `${ratioLabel} · ${resolution.toUpperCase()}`;
}

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

  const resOptions = videoMode
    ? resolutions.filter((r) => r.id !== "4k")
    : resolutions;

  return (
    <CompactDockSheet
      open={open}
      onClose={() => setOpen(false)}
      title="图片质量"
      desktopWidthClass="w-[min(100vw-2rem,22rem)]"
      matchTriggerWidth
      placement="above"
      maxHeight="min(320px,45vh)"
      trigger={
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex max-w-[9rem] shrink-0 items-center gap-1 truncate rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/10 sm:max-w-none"
          aria-label="图片尺寸与分辨率"
        >
          <Sparkles className="size-3 shrink-0 text-orange-400" />
          <span className="truncate">
            {aspectTriggerLabel(aspectRatio, resolution)}
          </span>
          <ChevronDown
            className={`size-3 shrink-0 opacity-60 transition ${open ? "rotate-180" : ""}`}
          />
        </button>
      }
    >
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
        比例
      </p>
      <div className="grid grid-cols-4 gap-2">
        {aspects.map((a) => {
          const selected = aspectRatio === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onAspectRatioChange(a.id)}
              className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[10px] transition ${
                selected
                  ? "border-orange-500/60 bg-orange-500/15 text-orange-100"
                  : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:bg-white/10"
              }`}
            >
              <AspectRatioPreview
                ratio={a.id}
                selected={selected}
                smart={a.smart}
              />
              <span>{a.label}</span>
            </button>
          );
        })}
      </div>
      <p className="mb-1.5 mt-3 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
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
            className={`flex-1 rounded-lg py-2 text-xs transition ${
              resolution === r.id
                ? "bg-orange-500 text-white"
                : "bg-white/5 text-zinc-400 hover:bg-white/10"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      {mode === "quick" ? (
        <p className="mt-2 text-[10px] text-zinc-500">
          智能比例将根据描述自动选择最佳画幅
        </p>
      ) : null}
    </CompactDockSheet>
  );
}
