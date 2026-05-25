import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { ObjectStorage } from "./types.js";

function mimeToExt(mime: string) {
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return ".jpg";
}

function getClient() {
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

function publicUrl(key: string) {
  const base = process.env.S3_PUBLIC_URL?.replace(/\/$/, "");
  if (base) return `${base}/${key}`;
  const bucket = process.env.S3_BUCKET!;
  const region = process.env.S3_REGION ?? "us-east-1";
  if (process.env.S3_ENDPOINT) {
    return `${process.env.S3_ENDPOINT.replace(/\/$/, "")}/${bucket}/${key}`;
  }
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

export const s3ObjectStorage: ObjectStorage = {
  name: "s3",
  async put(buffer, mimeType, originalName) {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new Error("S3_BUCKET_REQUIRED");

    const prefix = (process.env.S3_PREFIX ?? "uploads/").replace(/^\//, "");
    const ext = path.extname(originalName) || mimeToExt(mimeType);
    const key = `${prefix}${randomUUID()}${ext}`;

    const client = getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ACL: process.env.S3_ACL as "public-read" | undefined,
      }),
    );

    return {
      key,
      url: publicUrl(key),
      sizeBytes: buffer.length,
    };
  },
};
