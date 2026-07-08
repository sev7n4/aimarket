import { resolveApiBase } from "@/lib/api-base";
import type { ApiErrorBody } from "../types";

export const API_BASE = resolveApiBase();

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("aimarket_token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("aimarket_token", token);
  else localStorage.removeItem("aimarket_token");
}

export async function request<T>(
  path: string,
  init?: RequestInit & { auth?: boolean },
): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  if (init?.body && !(init.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (init?.auth !== false) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = json as ApiErrorBody;
    throw new Error(err.error?.message ?? `请求失败 (${res.status})`);
  }
  return json as T;
}

export function assetUrl(path: string) {
  const normalized = path.trim();
  if (
    normalized.startsWith("http") ||
    normalized.startsWith("blob:") ||
    normalized.startsWith("data:")
  ) {
    return normalized;
  }
  const relativePath = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return `${API_BASE}${relativePath}`;
}
