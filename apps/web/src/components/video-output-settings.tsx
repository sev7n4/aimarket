"use client";

import { useState } from "react";
import { ChevronDown, Monitor, Ratio, Timer } from "lucide-react";
import { CompactDockSheet } from "@/components/compact-dock-sheet";
import type {
  VideoDurationSec,
  VideoReferenceMode,
  VideoResolution,
} from "@/lib/creation-dock-prefs";
import {
  coerceVideoSettingsForMode,
  estimateSmartMultiFrameDuration,
  getVideoOutputPreset,
} from "@/lib/video-output-presets";

const DOCK_PILL =
  "inline-flex max-w-[5.5rem] shrink-0 items-center gap-1 truncate rounded-md px-1.5 py-1 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200 sm:max-w-[6.5rem]";

interface VideoOutputSettingsProps {
  referenceMode: VideoReferenceMode;
  aspectRatio: string;
  videoResolution: VideoResolution;
  durationSec: VideoDurationSec;
  onAspectRatioChange: (v: string) => void;
  onVideoResolutionChange: (v: VideoResolution) => void;
  onDurationSecChange: (v: VideoDurationSec) => void;
  shotCount?: number;
  disabled?: boolean;
}

export function VideoOutputSettings({
  referenceMode,
  aspectRatio,
  videoResolution,
  durationSec,
  onAspectRatioChange,
  onVideoResolutionChange,
  onDurationSecChange,
  shotCount = 2,
  disabled = false,
}: VideoOutputSettingsProps) {
  const preset = getVideoOutputPreset(referenceMode);
  const estimated =
    preset.durationFromShots && shotCount >= 2
      ? estimateSmartMultiFrameDuration(shotCount)
      : undefined;

  return (
    <>
      <AspectRatioPicker
        value={aspectRatio}
        options={preset.aspectRatios}
        onChange={onAspectRatioChange}
        disabled={disabled || preset.aspectRatios.length <= 1}
      />
      <ResolutionPicker
        value={videoResolution}
        options={preset.resolutions}
        onChange={onVideoResolutionChange}
        disabled={disabled || preset.resolutions.length <= 1}
      />
      {preset.durationFromShots ? (
        <span
          className="inline-flex max-w-[5rem] items-center gap-1 truncate px-1.5 py-1 text-[10px] text-zinc-500"
          title="智能多帧时长由镜头数推算"
        >
          <Timer className="size-3 shrink-0" />≈{estimated}s
        </span>
      ) : (
        <DurationPicker
          value={durationSec}
          options={preset.durations}
          onChange={onDurationSecChange}
          disabled={disabled}
        />
      )}
    </>
  );
}

/** 切换参考模式时重置非法输出组合 */
export function applyModeVideoSettings(
  mode: VideoReferenceMode,
  current: {
    aspectRatio: string;
    videoResolution: VideoResolution;
    videoDurationSec: VideoDurationSec;
  },
  shotCount = 2,
) {
  return coerceVideoSettingsForMode(mode, current, shotCount);
}

function AspectRatioPicker({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const label = value === "auto" ? "16:9" : value;
  return (
    <CompactDockSheet
      open={open}
      onClose={() => setOpen(false)}
      title="画幅"
      dense
      fitContent
      placement="above"
      trigger={
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={`${DOCK_PILL} disabled:opacity-50`}
        >
          <Ratio className="size-3.5 shrink-0" />
          <span>{label}</span>
          <ChevronDown className="size-3 shrink-0 opacity-50" />
        </button>
      }
    >
      <ul className="flex flex-col gap-0.5">
        {options.map((r) => (
          <li key={r}>
            <button
              type="button"
              onClick={() => {
                onChange(r);
                setOpen(false);
              }}
              className={`block w-full rounded-md px-2 py-2 text-left text-[11px] font-medium ${
                label === r ? "bg-sky-500/90 text-white" : "text-zinc-400 hover:bg-white/5"
              }`}
            >
              {r}
            </button>
          </li>
        ))}
      </ul>
    </CompactDockSheet>
  );
}

function ResolutionPicker({
  value,
  options,
  onChange,
  disabled,
}: {
  value: VideoResolution;
  options: readonly VideoResolution[];
  onChange: (v: VideoResolution) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <CompactDockSheet
      open={open}
      onClose={() => setOpen(false)}
      title="分辨率"
      dense
      fitContent
      placement="above"
      trigger={
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={`${DOCK_PILL} disabled:opacity-50`}
        >
          <Monitor className="size-3.5 shrink-0" />
          <span>{value}</span>
          <ChevronDown className="size-3 shrink-0 opacity-50" />
        </button>
      }
    >
      <ul className="flex flex-col gap-0.5">
        {options.map((r) => (
          <li key={r}>
            <button
              type="button"
              onClick={() => {
                onChange(r);
                setOpen(false);
              }}
              className={`block w-full rounded-md px-2 py-2 text-left text-[11px] font-medium ${
                value === r ? "bg-sky-500/90 text-white" : "text-zinc-400 hover:bg-white/5"
              }`}
            >
              {r}
            </button>
          </li>
        ))}
      </ul>
    </CompactDockSheet>
  );
}

function DurationPicker({
  value,
  options,
  onChange,
  disabled,
}: {
  value: VideoDurationSec;
  options: readonly VideoDurationSec[];
  onChange: (v: VideoDurationSec) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <CompactDockSheet
      open={open}
      onClose={() => setOpen(false)}
      title="时长"
      dense
      fitContent
      placement="above"
      trigger={
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={`${DOCK_PILL} max-w-[4.5rem] disabled:opacity-50`}
        >
          <Timer className="size-3.5 shrink-0" />
          <span>{value}s</span>
          <ChevronDown className="size-3 shrink-0 opacity-50" />
        </button>
      }
    >
      <ul className="flex flex-col gap-0.5">
        {options.map((sec) => (
          <li key={sec}>
            <button
              type="button"
              onClick={() => {
                onChange(sec);
                setOpen(false);
              }}
              className={`block w-full rounded-md px-2 py-2 text-left text-[11px] font-medium ${
                value === sec ? "bg-sky-500/90 text-white" : "text-zinc-400 hover:bg-white/5"
              }`}
            >
              {sec} 秒
            </button>
          </li>
        ))}
      </ul>
    </CompactDockSheet>
  );
}
