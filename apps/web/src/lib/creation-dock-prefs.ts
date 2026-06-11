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

/** 视频参考方式（即梦：全能参考 / 首尾帧 / 智能多帧） */
export type VideoReferenceMode =
  | "omni"
  | "first-last"
  | "smart-multi-frame";

export const VIDEO_REFERENCE_LABELS: Record<VideoReferenceMode, string> = {
  omni: "全能参考",
  "first-last": "首尾帧",
  "smart-multi-frame": "智能多帧",
};

export type VideoDurationSec = 4 | 5 | 6 | 8 | 10 | 12 | 15;
export type VideoResolution = "720P" | "1080P";

export type VideoMediaType = "image" | "audio" | "video";
export type VideoMediaRole = "reference" | "first_frame" | "last_frame";

export type VideoMediaRef = {
  assetId: string;
  mediaType: VideoMediaType;
  role?: VideoMediaRole;
  previewUrl?: string;
  label?: string;
};

export type SmartMultiShot = {
  order: number;
  assetId?: string;
  motionPrompt: string;
  previewUrl?: string;
};

export const OUTPUT_PREF_AUTO_LABEL = "自动";

/** 各创作车道 Dock 输入框占位（Studio / 首页单行态） */
export const CREATION_LANE_PLACEHOLDERS: Record<CreationLane, string> = {
  image: "描述画面；上传、@ 引用或点选画布图片作参考",
  agent: "告诉 Agent 目标，会自动选模型与步骤（不支持参考图）",
  video: "描述镜头与氛围；全能参考支持 @图/音/视，首尾帧与智能多帧见下方槽位",
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
