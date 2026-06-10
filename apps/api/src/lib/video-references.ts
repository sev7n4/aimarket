import { db } from "../db/index.js";
import { toPublicAssetUrl } from "./public-url.js";
import {
  coerceVideoDuration,
  estimateSmartMultiFrameDuration,
  type VideoDurationSec,
} from "./video-output-presets.js";

/** 对标即梦：全能参考 / 首尾帧 / 智能多帧 */
export type VideoReferenceMode =
  | "omni"
  | "first-last"
  | "smart-multi-frame";

export type VideoMediaType = "image" | "audio" | "video";

export type VideoMediaRole = "reference" | "first_frame" | "last_frame";

export type VideoMediaRef = {
  assetId: string;
  mediaType: VideoMediaType;
  role?: VideoMediaRole;
};

export type SmartMultiShot = {
  order: number;
  assetId?: string;
  motionPrompt: string;
};

export type ResolvedVideoMediaRef = VideoMediaRef & { url: string };

export type VideoResolution = "720P" | "1080P";

const LEGACY_FIRST_FRAME = "first-frame";

export function normalizeVideoReferenceMode(
  mode: string | undefined,
): VideoReferenceMode {
  if (mode === LEGACY_FIRST_FRAME) return "first-last";
  if (
    mode === "omni" ||
    mode === "first-last" ||
    mode === "smart-multi-frame"
  ) {
    return mode;
  }
  return "omni";
}

function inferMediaType(mimeType: string): VideoMediaType {
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "image";
}

export function resolveAssetReferenceUrls(
  assetIds: string[],
  userId: string,
): string[] {
  return resolveAssetMediaRefs(assetIds, userId).map((r) => r.url);
}

export function resolveAssetMediaRefs(
  assetIds: string[],
  userId: string,
): ResolvedVideoMediaRef[] {
  const refs: ResolvedVideoMediaRef[] = [];
  for (const assetId of assetIds) {
    const asset = db
      .prepare(
        "SELECT url, mime_type FROM assets WHERE id = ? AND user_id = ?",
      )
      .get(assetId, userId) as { url: string; mime_type: string } | undefined;
    if (!asset) continue;
    refs.push({
      assetId,
      mediaType: inferMediaType(asset.mime_type),
      url: toPublicAssetUrl(asset.url),
    });
  }
  return refs;
}

export function resolveStructuredVideoReferences(
  refs: VideoMediaRef[],
  userId: string,
): ResolvedVideoMediaRef[] {
  const resolved: ResolvedVideoMediaRef[] = [];
  for (const ref of refs) {
    const asset = db
      .prepare(
        "SELECT url, mime_type FROM assets WHERE id = ? AND user_id = ?",
      )
      .get(ref.assetId, userId) as { url: string; mime_type: string } | undefined;
    if (!asset) continue;
    resolved.push({
      ...ref,
      mediaType: ref.mediaType ?? inferMediaType(asset.mime_type),
      url: toPublicAssetUrl(asset.url),
    });
  }
  return resolved;
}

export function resolveSmartMultiShots(
  shots: SmartMultiShot[],
  userId: string,
): Array<SmartMultiShot & { url?: string }> {
  return shots
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((shot) => {
      if (!shot.assetId) return shot;
      const asset = db
        .prepare("SELECT url FROM assets WHERE id = ? AND user_id = ?")
        .get(shot.assetId, userId) as { url: string } | undefined;
      if (!asset) return shot;
      return { ...shot, url: toPublicAssetUrl(asset.url) };
    });
}

export function applyVideoReferenceMode(
  urls: string[],
  mode: VideoReferenceMode = "omni",
): string[] {
  if (!urls.length || mode === "omni" || mode === "smart-multi-frame") {
    return urls;
  }
  if (urls.length === 1) return urls;
  return [urls[0]!, urls[urls.length - 1]!];
}

const VIDEO_I2V_INSTRUCTION =
  "【图生视频】以参考图为首帧主体，保持主体一致，按描述生成镜头运动与氛围。";

export function buildVideoReferencePrompt(
  prompt: string,
  referenceUrls: string[],
): string {
  if (!referenceUrls.length) return prompt;
  return `${VIDEO_I2V_INSTRUCTION}\n\n${prompt.trim()}`;
}

export function buildSmartMultiFramePrompt(
  basePrompt: string,
  shots: Array<SmartMultiShot & { url?: string }>,
): string {
  const sorted = shots.slice().sort((a, b) => a.order - b.order);
  const perShot = sorted[0]?.motionPrompt ? 3 : 3;
  const timeline = sorted
    .map((shot, i) => {
      const start = i * perShot;
      const end = start + perShot;
      const label = `第${i + 1}个镜头[${start}-${end}秒]`;
      return `${label} ${shot.motionPrompt.trim()}`;
    })
    .join(" ");
  const trimmed = basePrompt.trim();
  if (!timeline) return trimmed || "请添加智能多帧的镜头";
  return trimmed ? `${trimmed}\n\n${timeline}` : timeline;
}

export type VideoReferenceValidation = {
  ok: boolean;
  code?: string;
  message?: string;
};

export function validateVideoReferencePayload(input: {
  mode: VideoReferenceMode;
  videoReferences?: VideoMediaRef[];
  smartMultiShots?: SmartMultiShot[];
  referenceUrls?: string[];
}): VideoReferenceValidation {
  const mode = normalizeVideoReferenceMode(input.mode);
  const refs = input.videoReferences ?? [];
  const shots = input.smartMultiShots ?? [];
  const legacyUrls = input.referenceUrls ?? [];

  if (mode === "first-last") {
    const frameRefs = refs.filter(
      (r) =>
        r.role === "first_frame" ||
        r.role === "last_frame" ||
        r.mediaType === "image",
    );
    const first = frameRefs.find((r) => r.role === "first_frame");
    const last = frameRefs.find((r) => r.role === "last_frame");
    const urlCount = legacyUrls.length || frameRefs.length;
    if (first && last) return { ok: true };
    if (urlCount >= 2) return { ok: true };
    if (urlCount === 1) {
      return {
        ok: true,
        message: "仅首帧：将按首帧图生视频（无尾帧）",
      };
    }
    return {
      ok: false,
      code: "FIRST_LAST_FRAMES_REQUIRED",
      message: "首尾帧模式需要至少上传首帧图片",
    };
  }

  if (mode === "smart-multi-frame") {
    if (shots.length < 2) {
      return {
        ok: false,
        code: "SMART_MULTI_SHOTS_REQUIRED",
        message: "智能多帧至少需要 2 个镜头",
      };
    }
    return { ok: true };
  }

  if (refs.length > 12) {
    return {
      ok: false,
      code: "OMNI_REF_LIMIT",
      message: "全能参考最多 12 条媒体",
    };
  }

  return { ok: true };
}

export function resolveEffectiveDurationSec(
  mode: VideoReferenceMode,
  durationSec: number | undefined,
  shotCount?: number,
): VideoDurationSec | undefined {
  return coerceVideoDuration(mode, durationSec, shotCount);
}

export function resolveSmartMultiDuration(
  shots: SmartMultiShot[],
): number {
  return estimateSmartMultiFrameDuration(Math.max(shots.length, 2));
}
