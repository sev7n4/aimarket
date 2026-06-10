import type { VideoReferenceMode } from "./creation-dock-prefs";

export type VideoResolution = "720P" | "1080P";
export type VideoDurationSec = 4 | 5 | 10;
export type VideoAspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4";

export type VideoOutputPreset = {
  defaultDuration: VideoDurationSec | null;
  durations: VideoDurationSec[];
  aspectRatios: VideoAspectRatio[];
  resolutions: VideoResolution[];
  defaultResolution: VideoResolution;
  defaultAspectRatio: VideoAspectRatio;
  durationFromShots?: boolean;
  secondsPerShot?: number;
};

const OMNI: VideoOutputPreset = {
  defaultDuration: 4,
  durations: [4, 5, 10],
  aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
  resolutions: ["720P", "1080P"],
  defaultResolution: "1080P",
  defaultAspectRatio: "16:9",
};

const FIRST_LAST: VideoOutputPreset = {
  defaultDuration: 5,
  durations: [5, 10],
  aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
  resolutions: ["720P", "1080P"],
  defaultResolution: "1080P",
  defaultAspectRatio: "16:9",
};

const SMART_MULTI: VideoOutputPreset = {
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
  if (mode === "first-last") return FIRST_LAST;
  if (mode === "smart-multi-frame") return SMART_MULTI;
  return OMNI;
}

export function estimateSmartMultiFrameDuration(shotCount: number): number {
  const n = Math.max(shotCount, 2);
  return Math.min(15, Math.max(4, n * (SMART_MULTI.secondsPerShot ?? 3)));
}

export function coerceVideoSettingsForMode(
  mode: VideoReferenceMode,
  current: {
    aspectRatio: string;
    videoResolution: VideoResolution;
    videoDurationSec: VideoDurationSec;
  },
  shotCount = 2,
): {
  aspectRatio: VideoAspectRatio;
  videoResolution: VideoResolution;
  videoDurationSec: VideoDurationSec;
  estimatedDurationSec?: number;
} {
  const preset = getVideoOutputPreset(mode);
  const aspectRatio = preset.aspectRatios.includes(
    current.aspectRatio as VideoAspectRatio,
  )
    ? (current.aspectRatio as VideoAspectRatio)
    : preset.defaultAspectRatio;
  const videoResolution = preset.resolutions.includes(current.videoResolution)
    ? current.videoResolution
    : preset.defaultResolution;

  if (preset.durationFromShots) {
    const est = estimateSmartMultiFrameDuration(shotCount);
    const videoDurationSec: VideoDurationSec =
      est <= 4 ? 4 : est <= 5 ? 5 : 10;
    return {
      aspectRatio,
      videoResolution,
      videoDurationSec,
      estimatedDurationSec: est,
    };
  }

  const videoDurationSec = preset.durations.includes(current.videoDurationSec)
    ? current.videoDurationSec
    : preset.defaultDuration ?? preset.durations[0] ?? 5;

  return { aspectRatio, videoResolution, videoDurationSec };
}

export function normalizeVideoReferenceMode(
  mode: string | undefined,
): VideoReferenceMode {
  if (mode === "first-frame") return "first-last";
  if (
    mode === "omni" ||
    mode === "first-last" ||
    mode === "smart-multi-frame"
  ) {
    return mode;
  }
  return "omni";
}
