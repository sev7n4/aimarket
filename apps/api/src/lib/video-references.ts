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
