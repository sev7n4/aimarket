/** Studio / 首页 Dock 创作车道（对标即梦 Agent 模式下拉） */
export type CreationLane = "agent" | "image" | "video";

/** 创作 Dock 存储作用域：首页与 Studio 车道偏好独立 */
export type CreationDockScope = "home" | "studio";

/** 当前活跃车道（完整参数草稿见 {@link LaneSettingsDraft} / useCreationLaneDrafts） */
export interface LaneDraft {
  lane: CreationLane;
}

/** 输出偏好：自动由路由决定，手动则使用下方模型/比例/张数 */
export type OutputPreferenceMode = "auto" | "manual";

/** 与即梦底部创作方式下拉文案一致 */
export const CREATION_LANE_LABELS: Record<CreationLane, string> = {
  agent: "Agent 模式",
  image: "图片生成",
  video: "视频生成",
};

/** 视频参考方式（即梦「全能参考」等，已接 /ai/generate/video） */
export type VideoReferenceMode = "omni" | "first-frame" | "first-last";

export const VIDEO_REFERENCE_LABELS: Record<VideoReferenceMode, string> = {
  omni: "全能参考",
  "first-frame": "首帧",
  "first-last": "首尾帧",
};

export type VideoDurationSec = 5 | 10;

export const OUTPUT_PREF_AUTO_LABEL = "自动";

/** 各创作车道 Dock 输入框占位（Studio / 首页单行态） */
export const CREATION_LANE_PLACEHOLDERS: Record<CreationLane, string> = {
  image: "描述画面；上传、@ 引用或点选画布图片作参考",
  agent: "告诉 Agent 目标，会自动选模型与步骤（不支持参考图）",
  video: "描述镜头与氛围；点选画布图片可作首帧或全能参考",
};

/** @deprecated 迁移至 {@link HOME_LANE_KEY} / {@link STUDIO_LANE_KEY} */
export const LEGACY_LANE_KEY = "aimarket.creationDock.lane";
export const HOME_LANE_KEY = "aimarket.home.lane";
export const STUDIO_LANE_KEY = "aimarket.studio.lane";

const OUTPUT_KEY = "aimarket.creationDock.outputMode";

let legacyLaneMigrated = false;

function laneKeyForScope(scope: CreationDockScope): string {
  return scope === "studio" ? STUDIO_LANE_KEY : HOME_LANE_KEY;
}

function parseCreationLane(value: string | null): CreationLane | null {
  if (value === "agent" || value === "image" || value === "video") return value;
  return null;
}

/** 将旧版共享 key 一次性复制到 home/studio（若对应 key 尚未设置） */
export function migrateLegacyCreationLaneStorage() {
  if (typeof window === "undefined" || legacyLaneMigrated) return;
  legacyLaneMigrated = true;

  const legacy = parseCreationLane(window.localStorage.getItem(LEGACY_LANE_KEY));
  if (!legacy) return;

  if (!parseCreationLane(window.localStorage.getItem(HOME_LANE_KEY))) {
    window.localStorage.setItem(HOME_LANE_KEY, legacy);
  }
  if (!parseCreationLane(window.localStorage.getItem(STUDIO_LANE_KEY))) {
    window.localStorage.setItem(STUDIO_LANE_KEY, legacy);
  }
  window.localStorage.removeItem(LEGACY_LANE_KEY);
}

export function defaultCreationLaneForScope(_scope: CreationDockScope): CreationLane {
  return "image";
}

export function readStoredCreationLane(
  scope: CreationDockScope,
  fallback: CreationLane = defaultCreationLaneForScope(scope),
): CreationLane {
  if (typeof window === "undefined") return fallback;
  migrateLegacyCreationLaneStorage();
  const stored = parseCreationLane(
    window.localStorage.getItem(laneKeyForScope(scope)),
  );
  return stored ?? fallback;
}

export function persistCreationLane(scope: CreationDockScope, lane: CreationLane) {
  try {
    window.localStorage.setItem(laneKeyForScope(scope), lane);
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
