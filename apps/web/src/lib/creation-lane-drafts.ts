import type { AspectRatio } from "../components/generation-settings-popover";
import type {
  CreationDockScope,
  CreationLane,
  OutputPreferenceMode,
  VideoDurationSec,
  VideoReferenceMode,
  VideoResolution,
} from "./creation-dock-prefs";
import {
  defaultCreationLaneForScope,
  migrateLegacyCreationLaneStorage,
  readStoredCreationLane,
  type LaneDraft,
} from "./creation-dock-prefs";
import { isInternalRoutingModelId } from "./format-generation-display";

export const AUTO_MODEL_ID = "auto";

/** 存盘/接口回落的内部 slug 统一为创作台 Auto */
export function normalizeLaneModelId(modelId: string): string {
  if (!modelId || modelId === AUTO_MODEL_ID) return AUTO_MODEL_ID;
  if (isInternalRoutingModelId(modelId)) return AUTO_MODEL_ID;
  return modelId;
}

/** 单车道生成参数草稿（prompt/refs 仍由 CreationPanel 全局管理） */
export interface LaneSettingsDraft {
  modelId: string;
  aspectRatio: AspectRatio;
  count: number;
  resolution: string;
  outputPrefMode: OutputPreferenceMode;
  videoReferenceMode: VideoReferenceMode;
  videoDurationSec: VideoDurationSec;
  videoResolution: VideoResolution;
}

export interface ScopeLaneDraftsState {
  activeLane: CreationLane;
  lanes: Record<CreationLane, LaneSettingsDraft>;
}

export const HOME_LANE_DRAFTS_KEY = "aimarket.home.laneDrafts";
export const STUDIO_LANE_DRAFTS_KEY = "aimarket.studio.laneDrafts";

/** @deprecated 迁移至 scope laneDrafts 内各车道 outputPrefMode */
const LEGACY_OUTPUT_KEY = "aimarket.creationDock.outputMode";

const ALL_LANES: CreationLane[] = ["agent", "image", "video"];

const ASPECT_RATIOS: AspectRatio[] = [
  "auto",
  "1:1",
  "4:3",
  "3:4",
  "16:9",
  "9:16",
  "3:2",
  "2:3",
  "4:5",
  "5:4",
  "21:9",
];

function parseAspectRatio(value: unknown): AspectRatio | null {
  if (typeof value !== "string") return null;
  return ASPECT_RATIOS.includes(value as AspectRatio)
    ? (value as AspectRatio)
    : null;
}

export function defaultLaneSettingsDraft(lane: CreationLane): LaneSettingsDraft {
  if (lane === "agent") {
    return {
      modelId: AUTO_MODEL_ID,
      aspectRatio: "auto",
      count: 1,
      resolution: "1k",
      outputPrefMode: "auto",
      videoReferenceMode: "omni",
      videoDurationSec: 4,
      videoResolution: "1080P",
    };
  }
  if (lane === "video") {
    return {
      modelId: AUTO_MODEL_ID,
      aspectRatio: "16:9",
      count: 1,
      resolution: "1k",
      outputPrefMode: "manual",
      videoReferenceMode: "omni",
      videoDurationSec: 4,
      videoResolution: "1080P",
    };
  }
  return {
    modelId: AUTO_MODEL_ID,
    aspectRatio: "auto",
    count: 1,
    resolution: "1k",
    /** 图片车道仅默认 Auto 模型；输出偏好「自动」仅用于 Agent 车道 */
    outputPrefMode: "manual",
    videoReferenceMode: "omni",
    videoDurationSec: 5,
    videoResolution: "1080P",
  };
}

export function createDefaultScopeLaneDrafts(
  scope: CreationDockScope,
  activeLane?: CreationLane,
): ScopeLaneDraftsState {
  const lane = activeLane ?? defaultCreationLaneForScope(scope);
  return {
    activeLane: lane,
    lanes: {
      agent: defaultLaneSettingsDraft("agent"),
      image: defaultLaneSettingsDraft("image"),
      video: defaultLaneSettingsDraft("video"),
    },
  };
}

function laneDraftsKeyForScope(scope: CreationDockScope): string {
  return scope === "studio" ? STUDIO_LANE_DRAFTS_KEY : HOME_LANE_DRAFTS_KEY;
}

function parseOutputPrefMode(value: unknown): OutputPreferenceMode | null {
  return value === "auto" || value === "manual" ? value : null;
}

function parseVideoReferenceMode(value: unknown): VideoReferenceMode | null {
  if (value === "first-frame") return "first-last";
  if (
    value === "omni" ||
    value === "first-last" ||
    value === "smart-multi-frame"
  ) {
    return value;
  }
  return null;
}

function parseVideoDurationSec(value: unknown): VideoDurationSec | null {
  const allowed: VideoDurationSec[] = [4, 5, 6, 8, 10, 12, 15];
  return typeof value === "number" &&
    allowed.includes(value as VideoDurationSec)
    ? (value as VideoDurationSec)
    : null;
}

function parseVideoResolution(value: unknown): VideoResolution | null {
  return value === "720P" || value === "1080P" ? value : null;
}

function parseLaneSettingsDraft(
  lane: CreationLane,
  value: unknown,
): LaneSettingsDraft {
  const base = defaultLaneSettingsDraft(lane);
  if (!value || typeof value !== "object") return base;
  const raw = value as Record<string, unknown>;
  return {
    modelId: normalizeLaneModelId(
      typeof raw.modelId === "string" && raw.modelId.length > 0
        ? raw.modelId
        : base.modelId,
    ),
    aspectRatio: parseAspectRatio(raw.aspectRatio) ?? base.aspectRatio,
    count:
      typeof raw.count === "number" && raw.count >= 1 && raw.count <= 8
        ? Math.floor(raw.count)
        : base.count,
    resolution:
      typeof raw.resolution === "string" &&
      ["1k", "2k", "4k"].includes(raw.resolution)
        ? raw.resolution
        : base.resolution,
    outputPrefMode:
      parseOutputPrefMode(raw.outputPrefMode) ?? base.outputPrefMode,
    videoReferenceMode:
      parseVideoReferenceMode(raw.videoReferenceMode) ??
      base.videoReferenceMode,
    videoDurationSec:
      parseVideoDurationSec(raw.videoDurationSec) ?? base.videoDurationSec,
    videoResolution:
      parseVideoResolution(raw.videoResolution) ?? base.videoResolution,
  };
}

function parseScopeLaneDraftsState(
  scope: CreationDockScope,
  value: unknown,
): ScopeLaneDraftsState | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const activeLane =
    raw.activeLane === "agent" ||
    raw.activeLane === "image" ||
    raw.activeLane === "video"
      ? raw.activeLane
      : null;
  if (!activeLane) return null;

  const lanesRaw = raw.lanes;
  const lanes = {} as Record<CreationLane, LaneSettingsDraft>;
  for (const lane of ALL_LANES) {
    const laneRaw =
      lanesRaw && typeof lanesRaw === "object"
        ? (lanesRaw as Record<string, unknown>)[lane]
        : undefined;
    lanes[lane] = parseLaneSettingsDraft(lane, laneRaw);
  }

  return { activeLane, lanes };
}

function migrateLegacyOutputPref(
  state: ScopeLaneDraftsState,
  legacyOutput: OutputPreferenceMode,
): ScopeLaneDraftsState {
  return {
    ...state,
    lanes: {
      ...state.lanes,
      [state.activeLane]: {
        ...state.lanes[state.activeLane],
        outputPrefMode: legacyOutput,
      },
    },
  };
}

export function readScopeLaneDrafts(scope: CreationDockScope): ScopeLaneDraftsState {
  if (typeof window === "undefined") {
    return createDefaultScopeLaneDrafts(scope);
  }

  migrateLegacyCreationLaneStorage();

  const storedRaw = window.localStorage.getItem(laneDraftsKeyForScope(scope));
  if (storedRaw) {
    try {
      const parsed = parseScopeLaneDraftsState(
        scope,
        JSON.parse(storedRaw) as unknown,
      );
      if (parsed) return parsed;
    } catch {
      /* fall through */
    }
  }

  const activeLane = readStoredCreationLane(scope);
  let state = createDefaultScopeLaneDrafts(scope, activeLane);

  const legacyOutput = window.localStorage.getItem(LEGACY_OUTPUT_KEY);
  const legacyPref = parseOutputPrefMode(legacyOutput);
  if (legacyPref) {
    state = migrateLegacyOutputPref(state, legacyPref);
  }

  return state;
}

export function persistScopeLaneDrafts(
  scope: CreationDockScope,
  state: ScopeLaneDraftsState,
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      laneDraftsKeyForScope(scope),
      JSON.stringify(state),
    );
  } catch {
    /* ignore */
  }
}

export function patchActiveLaneSettings(
  state: ScopeLaneDraftsState,
  patch: Partial<LaneSettingsDraft>,
): ScopeLaneDraftsState {
  const lane = state.activeLane;
  return {
    ...state,
    lanes: {
      ...state.lanes,
      [lane]: { ...state.lanes[lane], ...patch },
    },
  };
}

export function switchActiveLane(
  state: ScopeLaneDraftsState,
  toLane: CreationLane,
): ScopeLaneDraftsState {
  return {
    activeLane: toLane,
    lanes: {
      ...state.lanes,
      [toLane]: state.lanes[toLane] ?? defaultLaneSettingsDraft(toLane),
    },
  };
}

/** 与旧 LaneDraft 兼容的视图 */
export function toLaneDraft(state: ScopeLaneDraftsState): LaneDraft {
  return { lane: state.activeLane };
}
