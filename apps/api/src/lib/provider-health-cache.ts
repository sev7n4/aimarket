export type ProviderHealthStatus =
  | "ok"
  | "auth_error"
  | "quota_error"
  | "unavailable";

export interface CachedProviderHealth {
  status: ProviderHealthStatus;
  message?: string;
  expiresAt: number;
}

const cache = new Map<string, CachedProviderHealth>();

function ttlMs(status: ProviderHealthStatus): number {
  const ok = Number(process.env.TOOL_PROVIDER_HEALTH_CACHE_MS_OK ?? 60_000);
  const quota = Number(
    process.env.TOOL_PROVIDER_HEALTH_CACHE_MS_QUOTA ?? 120_000,
  );
  const auth = Number(process.env.TOOL_PROVIDER_HEALTH_CACHE_MS_AUTH ?? 300_000);
  const unavailable = Number(
    process.env.TOOL_PROVIDER_HEALTH_CACHE_MS_UNAVAILABLE ?? 90_000,
  );
  switch (status) {
    case "ok":
      return ok;
    case "quota_error":
      return quota;
    case "auth_error":
      return auth;
    case "unavailable":
      return unavailable;
  }
}

export function providerHealthCacheKey(providerName: string): string {
  return `tool:${providerName}`;
}

export function getCachedProviderHealth(
  providerName: string,
): CachedProviderHealth | null {
  const entry = cache.get(providerHealthCacheKey(providerName));
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(providerHealthCacheKey(providerName));
    return null;
  }
  return entry;
}

export function setCachedProviderHealth(
  providerName: string,
  status: ProviderHealthStatus,
  message?: string,
): void {
  cache.set(providerHealthCacheKey(providerName), {
    status,
    message,
    expiresAt: Date.now() + ttlMs(status),
  });
}

/** 根据上游错误文本/状态码推断健康状态（供探活与 job 失败回写共用） */
export function classifyProviderError(
  message: string,
  httpStatus?: number,
): ProviderHealthStatus | null {
  const text = message.trim();
  const lower = text.toLowerCase();

  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    lower.includes("invalidapikey") ||
    lower.includes("access.denied") ||
    lower.includes("unauthorized") ||
    lower.includes("鉴权失败") ||
    /api_key 未配置/.test(lower)
  ) {
    return "auth_error";
  }

  if (
    httpStatus === 429 ||
    lower.includes("429") ||
    lower.includes("setlimitexceeded") ||
    lower.includes("safe experience mode") ||
    lower.includes("推理上限") ||
    lower.includes("quota")
  ) {
    return "quota_error";
  }

  if (
    httpStatus != null &&
    httpStatus >= 500 &&
    httpStatus <= 599
  ) {
    return "unavailable";
  }

  if (
    /\b50[023]\b/.test(lower) ||
    lower.includes("upstream_error") ||
    lower.includes("internalservererror")
  ) {
    return "unavailable";
  }

  return null;
}

export function recordProviderHealthFailure(
  providerName: string,
  errorMessage: string,
  httpStatus?: number,
): void {
  const status = classifyProviderError(errorMessage, httpStatus);
  if (!status || status === "ok") return;
  setCachedProviderHealth(providerName, status, errorMessage.slice(0, 300));
}

export function clearProviderHealthCache(): void {
  cache.clear();
}
