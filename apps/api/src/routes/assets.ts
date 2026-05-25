import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import type { AuthVariables } from "../middleware/auth.js";
import { saveUpload } from "../lib/storage.js";
import { AppError } from "../lib/errors.js";

const assets = new Hono<{ Variables: AuthVariables }>();

assets.post("/upload", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.parseBody();
  const file = body.file;
  const sessionId =
    typeof body.sessionId === "string" ? body.sessionId : undefined;

  if (!file || !(file instanceof File)) {
    throw new AppError(400, "VALIDATION_ERROR", "请上传图片文件");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let saved: { filename: string; url: string; sizeBytes: number };
  try {
    saved = saveUpload(buffer, file.type, file.name);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UPLOAD_FAILED";
    if (msg === "UNSUPPORTED_MIME") {
      throw new AppError(400, "UNSUPPORTED_MIME", "仅支持 JPG/PNG/WebP");
    }
    if (msg === "FILE_TOO_LARGE") {
      throw new AppError(400, "FILE_TOO_LARGE", "文件不能超过 10MB");
    }
    throw new AppError(500, "UPLOAD_FAILED", "上传失败");
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO assets (id, user_id, session_id, filename, url, mime_type, size_bytes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    userId,
    sessionId ?? null,
    saved.filename,
    saved.url,
    file.type,
    saved.sizeBytes,
  );

  return c.json({
    data: {
      id,
      url: saved.url,
      mimeType: file.type,
      sizeBytes: saved.sizeBytes,
    },
  });
});

export { assets };
