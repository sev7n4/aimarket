import fs from "node:fs";
import path from "node:path";
import { getObjectStorage } from "./object-storage/index.js";

const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const AUDIO_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
]);
const VIDEO_MIME = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
]);

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const AUDIO_MAX_BYTES = 15 * 1024 * 1024;

const UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

export type UploadLane = "default" | "video";

function maxBytesForMime(mimeType: string, lane: UploadLane): number {
  if (VIDEO_MIME.has(mimeType)) return VIDEO_MAX_BYTES;
  if (AUDIO_MIME.has(mimeType)) return AUDIO_MAX_BYTES;
  if (lane === "video" && IMAGE_MIME.has(mimeType)) return DEFAULT_MAX_BYTES;
  return DEFAULT_MAX_BYTES;
}

export function isAllowedUploadMime(
  mimeType: string,
  lane: UploadLane = "default",
): boolean {
  if (IMAGE_MIME.has(mimeType)) return true;
  if (lane === "video") {
    return AUDIO_MIME.has(mimeType) || VIDEO_MIME.has(mimeType);
  }
  return false;
}

export function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export async function saveUpload(
  buffer: Buffer,
  mimeType: string,
  originalName: string,
  options?: { lane?: UploadLane },
) {
  const lane = options?.lane ?? "default";
  if (!isAllowedUploadMime(mimeType, lane)) {
    throw new Error("UNSUPPORTED_MIME");
  }
  const maxBytes = maxBytesForMime(mimeType, lane);
  if (buffer.length > maxBytes) {
    throw new Error("FILE_TOO_LARGE");
  }

  const stored = await getObjectStorage().put(buffer, mimeType, originalName);
  return {
    filename: stored.key,
    url: stored.url,
    sizeBytes: stored.sizeBytes,
  };
}

export function getUploadDir() {
  return UPLOAD_DIR;
}

export async function saveGeneratedImage(
  buffer: Buffer,
  mimeType = "image/png",
) {
  if (buffer.length > DEFAULT_MAX_BYTES) {
    throw new Error("GENERATED_IMAGE_TOO_LARGE");
  }
  const ext =
    mimeType === "image/png"
      ? ".png"
      : mimeType === "image/webp"
        ? ".webp"
        : ".jpg";
  return saveUpload(buffer, mimeType, `generated${ext}`);
}

export async function persistRemoteImageUrl(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) {
    throw new Error(`下载生成图失败 (${res.status})`);
  }
  const mime =
    res.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/png";
  const buffer = Buffer.from(await res.arrayBuffer());
  return (await saveGeneratedImage(buffer, mime)).url;
}
