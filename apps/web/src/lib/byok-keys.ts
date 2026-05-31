/** @deprecated 已迁移至服务端 /api/v1/user/providerConfig，仅用于一次性本地迁移 */
const STORAGE_KEY = "aimarket_byok_keys";

export type ByokProvider = "openai";

export interface ByokKeys {
  openai?: string;
}

export function loadByokKeys(): ByokKeys {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ByokKeys) : {};
  } catch {
    return {};
  }
}

export function clearByokKeys() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function hasByokConfigured(keys: ByokKeys): boolean {
  return Boolean(keys.openai?.trim());
}
