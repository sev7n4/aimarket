import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getUploadDir } from "./storage.js";

const THUMB_DIR = "thumbs";
const THUMB_WIDTH = 360;

function localUploadPath(url: string) {
  if (!url.startsWith("/uploads/")) return null;
  const relative = url.replace(/^\/uploads\//, "");
  if (relative.includes("..")) return null;
  return path.join(getUploadDir(), relative);
}

export function thumbUrlFor(url: string): string {
  if (!url.startsWith("/uploads/")) return url;
  const relative = url.replace(/^\/uploads\//, "");
  const parsed = path.parse(relative);
  return `/uploads/${THUMB_DIR}/${parsed.name}.webp`;
}

export async function ensureThumbnail(url: string): Promise<string> {
  if (!url.startsWith("/uploads/")) return url;
  if (url.includes("/thumbs/")) return url;
  if (url.endsWith(".mp4") || url.includes("video")) return url;

  const source = localUploadPath(url);
  if (!source) return url;

  const targetUrl = thumbUrlFor(url);
  const target = localUploadPath(targetUrl);
  if (!target) return url;

  try {
    await fs.access(target);
    return targetUrl;
  } catch {
    // Generate below.
  }

  await fs.mkdir(path.dirname(target), { recursive: true });
  try {
    await sharp(source)
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: 72 })
      .toFile(target);
    return targetUrl;
  } catch {
    return url;
  }
}

export async function ensureThumbnails(urls: string[]) {
  return Promise.all(urls.map((url) => ensureThumbnail(url)));
}
