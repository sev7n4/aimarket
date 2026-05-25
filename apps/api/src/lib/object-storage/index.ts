import { localObjectStorage } from "./local.js";
import { s3ObjectStorage } from "./s3.js";
import type { ObjectStorage, StoredObject } from "./types.js";

export type { ObjectStorage, StoredObject };

export function resolveObjectStorage(): ObjectStorage {
  const mode = process.env.STORAGE_PROVIDER ?? "auto";
  if (mode === "local") return localObjectStorage;
  if (mode === "s3") return s3ObjectStorage;
  if (
    process.env.S3_BUCKET &&
    (process.env.S3_ACCESS_KEY_ID || process.env.S3_ENDPOINT)
  ) {
    return s3ObjectStorage;
  }
  return localObjectStorage;
}

export function getStorageStatus() {
  const active = resolveObjectStorage();
  return {
    provider: active.name,
    mode: process.env.STORAGE_PROVIDER ?? "auto",
    bucket: process.env.S3_BUCKET ?? null,
    publicUrl: process.env.S3_PUBLIC_URL ?? null,
  };
}

let storage: ObjectStorage | null = null;

export function getObjectStorage(): ObjectStorage {
  if (!storage) storage = resolveObjectStorage();
  return storage;
}
