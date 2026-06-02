/** Studio / 首页 Dock 创作车道（对标即梦 Agent 模式下拉） */
export type CreationLane = "agent" | "image" | "video";

/** 输出偏好：自动由路由决定，手动则使用下方模型/比例/张数 */
export type OutputPreferenceMode = "auto" | "manual";

/** 与即梦底部创作方式下拉文案一致 */
export const CREATION_LANE_LABELS: Record<CreationLane, string> = {
  agent: "Agent 模式",
  image: "图片生成",
  video: "视频生成",
};

/** 视频参考方式（即梦「全能参考」等，UI 态；后续可接 API） */
export type VideoReferenceMode = "omni" | "first-frame" | "first-last";

export const VIDEO_REFERENCE_LABELS: Record<VideoReferenceMode, string> = {
  omni: "全能参考",
  "first-frame": "首帧",
  "first-last": "首尾帧",
};

export type VideoDurationSec = 5 | 10;

export const OUTPUT_PREF_AUTO_LABEL = "自动";

const LANE_KEY = "aimarket.creationDock.lane";
const OUTPUT_KEY = "aimarket.creationDock.outputMode";

export function readStoredCreationLane(
  fallback: CreationLane,
): CreationLane {
  if (typeof window === "undefined") return fallback;
  const v = window.localStorage.getItem(LANE_KEY);
  if (v === "agent" || v === "image" || v === "video") return v;
  return fallback;
}

export function persistCreationLane(lane: CreationLane) {
  try {
    window.localStorage.setItem(LANE_KEY, lane);
  } catch {
    /* ignore */
  }
}

export function readStoredOutputMode(
  fallback: OutputPreferenceMode,
): OutputPreferenceMode {
  if (typeof window === "undefined") return fallback;
  const v = window.localStorage.getItem(OUTPUT_KEY);
  if (v === "auto" || v === "manual") return v;
  return fallback;
}

export function persistOutputMode(mode: OutputPreferenceMode) {
  try {
    window.localStorage.setItem(OUTPUT_KEY, mode);
  } catch {
    /* ignore */
  }
}
