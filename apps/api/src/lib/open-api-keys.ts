import { createHash, randomBytes, randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { AppError } from "./errors.js";

export const OPEN_API_KEY_PREFIX = "moyu_sk_";

export interface OpenApiKeyRow {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  created_at: string;
  revoked_at: string | null;
}

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateOpenApiKeyMaterial(): string {
  return `${OPEN_API_KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
}

export function createOpenApiKey(
  userId: string,
  name = "default",
): { id: string; key: string; prefix: string } {
  const key = generateOpenApiKeyMaterial();
  const id = randomUUID();
  const prefix = key.slice(0, OPEN_API_KEY_PREFIX.length + 8);
  db.prepare(
    `INSERT INTO open_api_keys (id, user_id, name, key_prefix, key_hash)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, userId, name, prefix, hashApiKey(key));
  return { id, key, prefix };
}

export function resolveOpenApiKey(
  rawKey: string | undefined,
): { userId: string; keyId: string } | null {
  if (!rawKey?.startsWith(OPEN_API_KEY_PREFIX)) return null;
  const row = db
    .prepare(
      `SELECT id, user_id, revoked_at FROM open_api_keys WHERE key_hash = ?`,
    )
    .get(hashApiKey(rawKey)) as
    | { id: string; user_id: string; revoked_at: string | null }
    | undefined;
  if (!row || row.revoked_at) return null;
  return { userId: row.user_id, keyId: row.id };
}

export function revokeOpenApiKey(userId: string, keyId: string) {
  const row = db
    .prepare(`SELECT id FROM open_api_keys WHERE id = ? AND user_id = ?`)
    .get(keyId, userId) as { id: string } | undefined;
  if (!row) {
    throw new AppError(404, "NOT_FOUND", "API Key 不存在");
  }
  db.prepare(
    `UPDATE open_api_keys SET revoked_at = datetime('now') WHERE id = ?`,
  ).run(keyId);
}
