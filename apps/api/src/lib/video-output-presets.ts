import type { VideoReferenceMode } from "./video-references.js";

export type VideoResolution = "720P" | "1080P";
export type VideoDurationSec = 4 | 5 | 6 | 8 | 10 | 12 | 15;
export type VideoAspectRatio =
  | "16:9"
  | "9:16"
  | "1:1"
  | "4:3"
  | "3:4"
  | "21:9";

export type VideoOutputPreset = {
  defaultDuration: VideoDurationSec | null;
  durations: VideoDurationSec[];
  aspectRatios: VideoAspectRatio[];
  resolutions: VideoResolution[];
  defaultResolution: VideoResolution;
  defaultAspectRatio: VideoAspectRatio;
  /** 智能多帧：固定画幅/分辨率，时长由镜头数推算 */
  durationFromShots?: boolean;
  secondsPerShot?: number;
};

const OMNI_PRESET: VideoOutputPreset = {
  defaultDuration: 4,
  durations: [4, 5, 6, 8, 10, 12, 15],
  aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
  resolutions: ["720P", "1080P"],
  defaultResolution: "1080P",
  defaultAspectRatio: "16:9",
};

const FIRST_LAST_PRESET: VideoOutputPreset = {
  defaultDuration: 5,
  durations: [5, 6, 8, 10, 12, 15],
  aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
  resolutions: ["720P", "1080P"],
  defaultResolution: "1080P",
  defaultAspectRatio: "16:9",
};

const SMART_MULTI_PRESET: VideoOutputPreset = {
  defaultDuration: null,
  durations: [],
  aspectRatios: ["16:9"],
  resolutions: ["720P"],
  defaultResolution: "720P",
  defaultAspectRatio: "16:9",
  durationFromShots: true,
  secondsPerShot: 3,
};

export function getVideoOutputPreset(
  mode: VideoReferenceMode,
): VideoOutputPreset {
  switch (mode) {
    case "first-last":
      return FIRST_LAST_PRESET;
    case "smart-multi-frame":
      return SMART_MULTI_PRESET;
    default:
      return OMNI_PRESET;
  }
}

export function snapVideoDurationSec(estimatedSec: number): VideoDurationSec {
  const options: VideoDurationSec[] = [4, 5, 6, 8, 10, 12, 15];
  return options.reduce((best, d) =>
    Math.abs(d - estimatedSec) < Math.abs(best - estimatedSec) ? d : best,
  );
}

export function estimateSmartMultiFrameDuration(shotCount: number): number {
  const n = Math.max(shotCount, 2);
  return Math.min(15, Math.max(4, n * (SMART_MULTI_PRESET.secondsPerShot ?? 3)));
}

export function coerceVideoDuration(
  mode: VideoReferenceMode,
  durationSec: number | undefined,
  shotCount?: number,
): VideoDurationSec | undefined {
  const preset = getVideoOutputPreset(mode);
  if (preset.durationFromShots) {
    const est = estimateSmartMultiFrameDuration(shotCount ?? 2);
    return snapVideoDurationSec(est);
  }
  const d = durationSec ?? preset.defaultDuration ?? 5;
  if (preset.durations.includes(d as VideoDurationSec)) {
    return d as VideoDurationSec;
  }
  return preset.defaultDuration ?? preset.durations[0] ?? 5;
}

export function coerceVideoAspectRatio(
  mode: VideoReferenceMode,
  aspectRatio: string | undefined,
): VideoAspectRatio {
  const preset = getVideoOutputPreset(mode);
  if (
    aspectRatio &&
    preset.aspectRatios.includes(aspectRatio as VideoAspectRatio)
  ) {
    return aspectRatio as VideoAspectRatio;
  }
  return preset.defaultAspectRatio;
}

export function coerceVideoResolution(
  mode: VideoReferenceMode,
  videoResolution: VideoResolution | undefined,
): VideoResolution {
  const preset = getVideoOutputPreset(mode);
  if (videoResolution && preset.resolutions.includes(videoResolution)) {
    return videoResolution;
  }
  return preset.defaultResolution;
}

export function mapAspectRatioForWan(
  aspectRatio: VideoAspectRatio | string,
): string {
  if (aspectRatio === "auto") return "16:9";
  if (aspectRatio === "21:9") return "16:9";
  const allowed = ["16:9", "9:16", "1:1", "4:3", "3:4"] as const;
  return allowed.includes(aspectRatio as (typeof allowed)[number])
    ? aspectRatio
    : "16:9";
}

/** 21:9 等万相暂不原生支持的画幅 */
export function wanAspectRatioDegradationNote(
  aspectRatio: string | undefined,
): string | undefined {
  if (aspectRatio === "21:9") {
    return "21:9 将按 16:9 提交万相";
  }
  return undefined;
}
