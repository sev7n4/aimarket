import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db/index.js";
import type { AuthVariables } from "../middleware/auth.js";
import { saveUpload } from "../lib/storage.js";
import { AppError } from "../lib/errors.js";
import { getSessionById } from "../lib/session-access.js";
import {
  completeLocalAssetUpload,
  confirmAssetUpload,
  createUploadIntent,
} from "../lib/asset-upload.js";

const assets = new Hono<{ Variables: AuthVariables }>();

assets.post("/upload-url", async (c) => {
  const userId = c.get("userId");
  const body = z
    .object({
      fileName: z.string().min(1).max(255),
      mimeType: z.string(),
      sizeBytes: z.number().int().positive(),
      sessionId: z.string().uuid().optional(),
    })
    .parse(await c.req.json());

  const intent = await createUploadIntent(userId, body);
  return c.json({ data: intent });
});

assets.post("/confirm", async (c) => {
  const userId = c.get("userId");
  const body = z
    .object({
      assetId: z.string().uuid(),
    })
    .parse(await c.req.json());

  const asset = await confirmAssetUpload(userId, body.assetId);
  return c.json({ data: asset });
});

assets.post("/upload/complete", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.parseBody();
  const assetId =
    typeof body.assetId === "string" ? body.assetId : undefined;
  const file = body.file;

  if (!assetId || !file || !(file instanceof File)) {
    throw new AppError(400, "VALIDATION_ERROR", "需要 assetId 与 file");
  }

  const asset = await completeLocalAssetUpload(userId, assetId, file);
  return c.json({ data: asset });
});

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
    saved = await saveUpload(buffer, file.type, file.name);
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

  let boundSessionId: string | null = sessionId ?? null;
  if (boundSessionId && !getSessionById(boundSessionId)) {
    throw new AppError(
      400,
      "SESSION_NOT_READY",
      "会话尚未创建，请刷新页面后重试",
    );
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO assets (id, user_id, session_id, filename, url, mime_type, size_bytes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    userId,
    boundSessionId,
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

/** 将外链图片登记为会话素材（灵感参考套图等） */
assets.post("/register-url", async (c) => {
  const userId = c.get("userId");
  const body = z
    .object({
      sessionId: z.string().uuid(),
      url: z.string().url().max(2000),
      fileName: z.string().max(255).optional(),
    })
    .parse(await c.req.json());

  const id = randomUUID();
  const filename = body.fileName ?? `ref-${id.slice(0, 8)}.jpg`;
  db.prepare(
    `INSERT INTO assets (id, user_id, session_id, filename, url, mime_type, size_bytes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    userId,
    body.sessionId,
    filename,
    body.url,
    "image/jpeg",
    0,
  );

  return c.json({
    data: {
      id,
      url: body.url,
      mimeType: "image/jpeg",
      sizeBytes: 0,
    },
  });
});

export { assets };
