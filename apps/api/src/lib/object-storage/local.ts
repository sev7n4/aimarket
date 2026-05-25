import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ObjectStorage } from "./types.js";

const UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

function mimeToExt(mime: string) {
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return ".jpg";
}

export const localObjectStorage: ObjectStorage = {
  name: "local",
  async put(buffer, mimeType, originalName) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const ext = path.extname(originalName) || mimeToExt(mimeType);
    const filename = `${randomUUID()}${ext}`;
    const fullPath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(fullPath, buffer);
    return {
      key: filename,
      url: `/uploads/${filename}`,
      sizeBytes: buffer.length,
    };
  },
};
