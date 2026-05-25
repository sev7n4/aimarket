import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_BYTES = 10 * 1024 * 1024;

export function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export function saveUpload(
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

  ensureUploadDir();
  const ext = path.extname(originalName) || mimeToExt(mimeType);
  const filename = `${randomUUID()}${ext}`;
  const fullPath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(fullPath, buffer);

  return {
    filename,
    url: `/uploads/${filename}`,
    sizeBytes: buffer.length,
  };
}

function mimeToExt(mime: string) {
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return ".jpg";
}

export function getUploadDir() {
  return UPLOAD_DIR;
}

/** 将生成结果写入本地 uploads，返回可长期访问的 `/uploads/...` 路径 */
export function saveGeneratedImage(
  buffer: Buffer,
  mimeType = "image/png",
) {
  if (buffer.length > MAX_BYTES) {
    throw new Error("GENERATED_IMAGE_TOO_LARGE");
  }
  return saveUpload(buffer, mimeType, `generated${mimeToExt(mimeType)}`);
}

/** 拉取远程图片并落盘（OpenAI 临时 URL 等） */
export async function persistRemoteImageUrl(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) {
    throw new Error(`下载生成图失败 (${res.status})`);
  }
  const mime =
    res.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/png";
  const buffer = Buffer.from(await res.arrayBuffer());
  return saveGeneratedImage(buffer, mime).url;
}
