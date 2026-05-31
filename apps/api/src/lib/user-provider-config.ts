import { db } from "../db/index.js";
import { decryptSecret, encryptSecret } from "./secret-crypto.js";

export interface UserProviderConfigRow {
  user_id: string;
  use_byok: number;
  openai_key_enc: string | null;
  openai_base_url: string | null;
  updated_at: string;
}

export interface UserProviderConfigPublic {
  useByok: boolean;
  openai: {
    configured: boolean;
    keyHint: string | null;
    baseUrl: string | null;
  };
}

export interface OpenAiCredentials {
  apiKey: string;
  baseUrl: string;
  source: "env" | "byok";
}

function maskKey(key: string): string {
  const t = key.trim();
  if (t.length <= 8) return "••••••••";
  return `${t.slice(0, 3)}…${t.slice(-4)}`;
}

function rowForUser(userId: string): UserProviderConfigRow | undefined {
  return db
    .prepare(
      `SELECT user_id, use_byok, openai_key_enc, openai_base_url, updated_at
       FROM user_provider_config WHERE user_id = ?`,
    )
    .get(userId) as UserProviderConfigRow | undefined;
}

export function getUserProviderConfigPublic(
  userId: string,
): UserProviderConfigPublic {
  const row = rowForUser(userId);
  const key =
    row?.openai_key_enc ?
      (() => {
        try {
          return decryptSecret(row.openai_key_enc);
        } catch {
          return null;
        }
      })()
    : null;

  return {
    useByok: Boolean(row?.use_byok),
    openai: {
      configured: Boolean(key?.trim()),
      keyHint: key?.trim() ? maskKey(key) : null,
      baseUrl: row?.openai_base_url ?? null,
    },
  };
}

export function userHasByokOpenAi(userId: string): boolean {
  const row = rowForUser(userId);
  if (!row?.use_byok || !row.openai_key_enc) return false;
  try {
    return Boolean(decryptSecret(row.openai_key_enc).trim());
  } catch {
    return false;
  }
}

export function resolveOpenAiCredentials(
  userId?: string,
): OpenAiCredentials | null {
  const envKey = process.env.OPENAI_API_KEY?.trim();
  const envBase =
    process.env.OPENAI_BASE_URL?.replace(/\/$/, "") ??
    "https://api.openai.com/v1";

  if (userId) {
    const row = rowForUser(userId);
    if (row?.use_byok && row.openai_key_enc) {
      try {
        const apiKey = decryptSecret(row.openai_key_enc).trim();
        if (apiKey) {
          const baseUrl =
            row.openai_base_url?.replace(/\/$/, "") || envBase;
          return { apiKey, baseUrl, source: "byok" };
        }
      } catch {
        /* 解密失败则回落 env */
      }
    }
  }

  if (envKey) {
    return { apiKey: envKey, baseUrl: envBase, source: "env" };
  }
  return null;
}

export function saveUserProviderConfig(
  userId: string,
  input: {
    useByok?: boolean;
    openai?: { apiKey?: string | null; baseUrl?: string | null };
  },
): UserProviderConfigPublic {
  const existing = rowForUser(userId);
  const useByok =
    input.useByok !== undefined ?
      input.useByok
    : Boolean(existing?.use_byok);

  let openaiKeyEnc = existing?.openai_key_enc ?? null;
  let openaiBaseUrl = existing?.openai_base_url ?? null;

  if (input.openai !== undefined) {
    if (input.openai.apiKey === null || input.openai.apiKey === "") {
      openaiKeyEnc = null;
    } else if (typeof input.openai.apiKey === "string") {
      const trimmed = input.openai.apiKey.trim();
      if (trimmed) openaiKeyEnc = encryptSecret(trimmed);
    }
    if (input.openai.baseUrl !== undefined) {
      const b = input.openai.baseUrl?.trim();
      openaiBaseUrl = b ? b.replace(/\/$/, "") : null;
    }
  }

  if (existing) {
    db.prepare(
      `UPDATE user_provider_config
       SET use_byok = ?, openai_key_enc = ?, openai_base_url = ?, updated_at = datetime('now')
       WHERE user_id = ?`,
    ).run(useByok ? 1 : 0, openaiKeyEnc, openaiBaseUrl, userId);
  } else {
    db.prepare(
      `INSERT INTO user_provider_config (user_id, use_byok, openai_key_enc, openai_base_url)
       VALUES (?, ?, ?, ?)`,
    ).run(userId, useByok ? 1 : 0, openaiKeyEnc, openaiBaseUrl);
  }

  return getUserProviderConfigPublic(userId);
}

export function clearUserProviderConfig(userId: string) {
  db.prepare("DELETE FROM user_provider_config WHERE user_id = ?").run(userId);
}
