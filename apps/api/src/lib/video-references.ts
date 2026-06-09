import { db } from "../db/index.js";
import { toPublicAssetUrl } from "./public-url.js";

export type VideoReferenceMode = "omni" | "first-frame" | "first-last";

export function resolveAssetReferenceUrls(
  assetIds: string[],
  userId: string,
): string[] {
  const urls: string[] = [];
  for (const assetId of assetIds) {
    const asset = db
      .prepare("SELECT url FROM assets WHERE id = ? AND user_id = ?")
      .get(assetId, userId) as { url: string } | undefined;
    if (asset) urls.push(toPublicAssetUrl(asset.url));
  }
  return urls;
}

export function applyVideoReferenceMode(
  urls: string[],
  mode: VideoReferenceMode = "omni",
): string[] {
  if (!urls.length || mode === "omni") return urls;
  if (mode === "first-frame") return [urls[0]!];
  if (urls.length === 1) return urls;
  return [urls[0]!, urls[urls.length - 1]!];
}

const VIDEO_I2V_INSTRUCTION =
  "【图生视频】以参考图为首帧主体，保持主体一致，按描述生成镜头运动与氛围。";

/** 视频车道：参考图走 `image` 字段，prompt 仅保留动作/镜头描述（不复用图生图 I2I 约束） */
export function buildVideoReferencePrompt(
  prompt: string,
  referenceUrls: string[],
): string {
  if (!referenceUrls.length) return prompt;
  return `${VIDEO_I2V_INSTRUCTION}\n\n${prompt.trim()}`;
}
