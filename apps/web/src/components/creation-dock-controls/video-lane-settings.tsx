"use client";

import { useState } from "react";
import { ChevronDown, Clapperboard, Timer } from "lucide-react";
import { CompactDockSheet } from "@/components/compact-dock-sheet";
import { ModelPicker } from "@/components/model-picker";
import {
  GenerationSettingsPopover,
  type AspectRatio,
} from "@/components/generation-settings-popover";
import type { ImageModel, VideoModelRouteMeta } from "@/lib/types";
import {
  VIDEO_REFERENCE_LABELS,
  type VideoDurationSec,
  type VideoReferenceMode,
  type VideoResolution,
} from "@/lib/creation-dock-prefs";
import {
  VideoOutputSettings,
  applyModeVideoSettings,
} from "@/components/video-output-settings";
import { DOCK_PILL } from "./shared";

interface VideoReferencePickerProps {
  value: VideoReferenceMode;
  onChange: (mode: VideoReferenceMode) => void;
  disabled?: boolean;
}

export function VideoReferencePicker({
  value,
  onChange,
  disabled = false,
}: VideoReferencePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <CompactDockSheet
      open={open}
      onClose={() => setOpen(false)}
      title="参考方式"
      dense
      fitContent
      placement="above"
      maxHeight="min(240px,40vh)"
      trigger={
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={`${DOCK_PILL} disabled:opacity-50`}
          aria-label="视频参考方式"
        >
          <Clapperboard className="size-3.5 shrink-0 text-sky-400/80" />
          <span className="truncate">{VIDEO_REFERENCE_LABELS[value]}</span>
          <ChevronDown
            className={`size-3 shrink-0 opacity-50 transition ${open ? "rotate-180" : ""}`}
          />
        </button>
      }
    >
      <ul className="flex flex-col gap-0.5">
        {(Object.keys(VIDEO_REFERENCE_LABELS) as VideoReferenceMode[]).map(
          (mode) => (
            <li key={mode}>
              <button
                type="button"
                onClick={() => {
                  onChange(mode);
                  setOpen(false);
                }}
                className={`block w-full rounded-md px-2 py-2 text-left text-[11px] font-medium transition ${
                  value === mode
                    ? "bg-sky-500/90 text-white"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                }`}
              >
                {VIDEO_REFERENCE_LABELS[mode]}
              </button>
            </li>
          ),
        )}
      </ul>
    </CompactDockSheet>
  );
}

interface VideoDurationPickerProps {
  value: VideoDurationSec;
  onChange: (sec: VideoDurationSec) => void;
  disabled?: boolean;
}

export function VideoDurationPicker({
  value,
  onChange,
  disabled = false,
}: VideoDurationPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <CompactDockSheet
      open={open}
      onClose={() => setOpen(false)}
      title="时长"
      dense
      fitContent
      placement="above"
      maxHeight="min(200px,36vh)"
      trigger={
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={`${DOCK_PILL} max-w-[4.5rem] disabled:opacity-50`}
          aria-label="视频时长"
        >
          <Timer className="size-3.5 shrink-0 text-zinc-400" />
          <span className="truncate">{value}s</span>
          <ChevronDown
            className={`size-3 shrink-0 opacity-50 transition ${open ? "rotate-180" : ""}`}
          />
        </button>
      }
    >
      <ul className="flex flex-col gap-0.5">
        {([5, 10] as const).map((sec) => (
          <li key={sec}>
            <button
              type="button"
              onClick={() => {
                onChange(sec);
                setOpen(false);
              }}
              className={`block w-full rounded-md px-2 py-2 text-left text-[11px] font-medium transition ${
                value === sec
                  ? "bg-sky-500/90 text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
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

interface VideoDockSettingsProps {
  models: ImageModel[];
  modelId: string;
  onModelChange: (id: string) => void;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (v: AspectRatio) => void;
  referenceMode: VideoReferenceMode;
  onReferenceModeChange: (mode: VideoReferenceMode) => void;
  durationSec: VideoDurationSec;
  onDurationSecChange: (sec: VideoDurationSec) => void;
  videoResolution: VideoResolution;
  onVideoResolutionChange: (v: VideoResolution) => void;
  smartMultiShotCount?: number;
  videoAutoLabel?: string;
  videoRoutes?: VideoModelRouteMeta[];
  disabled?: boolean;
}

export function VideoDockSettings({
  models,
  modelId,
  onModelChange,
  aspectRatio,
  onAspectRatioChange,
  referenceMode,
  onReferenceModeChange,
  durationSec,
  onDurationSecChange,
  videoResolution,
  onVideoResolutionChange,
  smartMultiShotCount = 2,
  videoAutoLabel,
  videoRoutes,
  disabled = false,
}: VideoDockSettingsProps) {
  const videoModels = models.filter((m) => m.type === "video");

  function handleReferenceModeChange(mode: VideoReferenceMode) {
    const coerced = applyModeVideoSettings(mode, {
      aspectRatio,
      videoResolution,
      videoDurationSec: durationSec,
    }, smartMultiShotCount);
    onReferenceModeChange(mode);
    onAspectRatioChange(coerced.aspectRatio as AspectRatio);
    onVideoResolutionChange(coerced.videoResolution);
    onDurationSecChange(coerced.videoDurationSec);
  }

  return (
    <>
      <div className={disabled ? "pointer-events-none opacity-50" : undefined}>
        <ModelPicker
          models={videoModels.length ? videoModels : models}
          value={modelId}
          onChange={onModelChange}
          autoLabel={videoAutoLabel}
          videoRoutes={videoRoutes}
          referenceMode={referenceMode}
        />
      </div>
      <VideoReferencePicker
        value={referenceMode}
        onChange={handleReferenceModeChange}
        disabled={disabled}
      />
      <div className={disabled ? "pointer-events-none opacity-50" : undefined}>
        <VideoOutputSettings
          referenceMode={referenceMode}
          aspectRatio={aspectRatio}
          videoResolution={videoResolution}
          durationSec={durationSec}
          onAspectRatioChange={(v) => onAspectRatioChange(v as AspectRatio)}
          onVideoResolutionChange={onVideoResolutionChange}
          onDurationSecChange={onDurationSecChange}
          shotCount={smartMultiShotCount}
          disabled={disabled}
        />
      </div>
    </>
  );
}