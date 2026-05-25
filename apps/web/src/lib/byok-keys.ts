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

export function saveByokKeys(keys: ByokKeys) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function hasByokConfigured(keys: ByokKeys): boolean {
  return Boolean(keys.openai?.trim());
}
