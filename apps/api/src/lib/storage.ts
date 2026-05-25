import fs from "node:fs";
import path from "node:path";
import { getObjectStorage } from "./object-storage/index.js";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_BYTES = 10 * 1024 * 1024;

const UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

export function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export async function saveUpload(
  buffer: Buffer,
  mimeType: string,
  originalName: string,
) {
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new Error("UNSUPPORTED_MIME");
  }
  if (buffer.length > MAX_BYTES) {
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
  if (buffer.length > MAX_BYTES) {
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
