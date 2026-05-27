import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  PutObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db } from "../db/index.js";
import { AppError } from "./errors.js";
import { getObjectStorage } from "./object-storage/index.js";
import { saveUpload } from "./storage.js";
import { getApiPublicBase } from "./public-url.js";

const MAX_BYTES = 10 * 1024 * 1024;
const PRESIGN_TTL_SEC = 900;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type UploadIntentInput = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sessionId?: string;
};

export type UploadIntentResult = {
  assetId: string;
  uploadUrl: string;
  method: "PUT" | "POST";
  headers?: Record<string, string>;
  expireAt: string;
  fields?: { assetId: string };
};

function mimeToExt(mime: string) {
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return ".jpg";
}

function apiPublicBase() {
  return getApiPublicBase();
}

function getS3Client() {
  const region = process.env.S3_REGION ?? "auto";
  return new S3Client({
    region,
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_FORCE_PATH_STYLE),
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
}

function s3PublicUrl(key: string) {
  const base = process.env.S3_PUBLIC_URL?.replace(/\/$/, "");
  if (base) return `${base}/${key}`;
  const bucket = process.env.S3_BUCKET!;
  const region = process.env.S3_REGION ?? "us-east-1";
  if (process.env.S3_ENDPOINT) {
    return `${process.env.S3_ENDPOINT.replace(/\/$/, "")}/${bucket}/${key}`;
  }
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

function parsePendingUrl(url: string) {
  if (!url.startsWith("pending:")) return null;
  const rest = url.slice("pending:".length);
  const colon = rest.indexOf(":");
  if (colon < 0) return null;
  return { kind: rest.slice(0, colon), ref: rest.slice(colon + 1) };
}

function getOwnedAsset(userId: string, assetId: string) {
  const row = db
    .prepare(
      `SELECT id, user_id, url, mime_type, size_bytes FROM assets WHERE id = ? AND user_id = ?`,
    )
    .get(assetId, userId) as
    | {
        id: string;
        user_id: string;
        url: string;
        mime_type: string;
        size_bytes: number;
      }
    | undefined;
  if (!row) {
    throw new AppError(404, "NOT_FOUND", "资产不存在");
  }
  return row;
}

function validateUploadMeta(mimeType: string, sizeBytes: number) {
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new AppError(400, "UNSUPPORTED_MIME", "仅支持 JPG/PNG/WebP");
  }
  if (sizeBytes > MAX_BYTES) {
    throw new AppError(400, "FILE_TOO_LARGE", "文件不能超过 10MB");
  }
}

export async function createUploadIntent(
  userId: string,
  input: UploadIntentInput,
): Promise<UploadIntentResult> {
  validateUploadMeta(input.mimeType, input.sizeBytes);

  const assetId = randomUUID();
  const expireAt = new Date(Date.now() + PRESIGN_TTL_SEC * 1000).toISOString();
  const storage = getObjectStorage();

  if (storage.name === "s3" && process.env.S3_BUCKET) {
    const prefix = (process.env.S3_PREFIX ?? "uploads/").replace(/^\//, "");
    const ext = path.extname(input.fileName) || mimeToExt(input.mimeType);
    const key = `${prefix}${assetId}${ext}`;
    const client = getS3Client();
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ContentType: input.mimeType,
      ACL: process.env.S3_ACL as "public-read" | undefined,
    });
    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: PRESIGN_TTL_SEC,
    });

    db.prepare(
      `INSERT INTO assets (id, user_id, session_id, filename, url, mime_type, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      assetId,
      userId,
      input.sessionId ?? null,
      input.fileName,
      `pending:s3:${key}`,
      input.mimeType,
      input.sizeBytes,
    );

    return {
      assetId,
      uploadUrl,
      method: "PUT",
      headers: { "Content-Type": input.mimeType },
      expireAt,
    };
  }

  db.prepare(
    `INSERT INTO assets (id, user_id, session_id, filename, url, mime_type, size_bytes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    assetId,
    userId,
    input.sessionId ?? null,
    input.fileName,
    `pending:local:${assetId}`,
    input.mimeType,
    0,
  );

  return {
    assetId,
    uploadUrl: `${apiPublicBase()}/api/v1/assets/upload/complete`,
    method: "POST",
    expireAt,
    fields: { assetId },
  };
}

export async function confirmAssetUpload(userId: string, assetId: string) {
  const row = getOwnedAsset(userId, assetId);
  const pending = parsePendingUrl(row.url);
  if (!pending || pending.kind !== "s3") {
    throw new AppError(400, "INVALID_STATE", "该资产无需 confirm 或已完成上传");
  }

  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new AppError(500, "CONFIG_ERROR", "S3 未配置");
  }

  const client = getS3Client();
  try {
    const head = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: pending.ref }),
    );
    const url = s3PublicUrl(pending.ref);
    const sizeBytes = Number(head.ContentLength ?? row.size_bytes);

    db.prepare(
      `UPDATE assets SET url = ?, size_bytes = ? WHERE id = ? AND user_id = ?`,
    ).run(url, sizeBytes, assetId, userId);

    return {
      id: assetId,
      url,
      mimeType: row.mime_type,
      sizeBytes,
    };
  } catch {
    throw new AppError(400, "UPLOAD_INCOMPLETE", "对象存储中未找到已上传文件");
  }
}

export async function completeLocalAssetUpload(
  userId: string,
  assetId: string,
  file: File,
) {
  const row = getOwnedAsset(userId, assetId);
  const pending = parsePendingUrl(row.url);
  if (!pending || pending.kind !== "local") {
    throw new AppError(400, "INVALID_STATE", "资产状态无效");
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

  db.prepare(
    `UPDATE assets SET filename = ?, url = ?, mime_type = ?, size_bytes = ? WHERE id = ? AND user_id = ?`,
  ).run(
    saved.filename,
    saved.url,
    file.type,
    saved.sizeBytes,
    assetId,
    userId,
  );

  return {
    id: assetId,
    url: saved.url,
    mimeType: file.type,
    sizeBytes: saved.sizeBytes,
  };
}

export function isAssetReady(url: string) {
  return !url.startsWith("pending:");
}
