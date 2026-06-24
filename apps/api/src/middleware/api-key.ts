import type { Context, Next } from "hono";
import { AppError } from "../lib/errors.js";
import { resolveOpenApiKey } from "../lib/open-api-keys.js";

export type ApiKeyVariables = {
  userId: string;
  apiKeyId: string;
};

function extractApiKey(c: Context): string | undefined {
  const headerKey = c.req.header("X-Api-Key")?.trim();
  if (headerKey) return headerKey;

  const auth = c.req.header("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token.startsWith("moyu_sk_")) return token;
  }
  return undefined;
}

export async function requireApiKey(c: Context, next: Next) {
  const raw = extractApiKey(c);
  const resolved = resolveOpenApiKey(raw);
  if (!resolved) {
    throw new AppError(401, "UNAUTHORIZED", "无效的 API Key");
  }
  c.set("userId", resolved.userId);
  c.set("apiKeyId", resolved.keyId);
  await next();
}
