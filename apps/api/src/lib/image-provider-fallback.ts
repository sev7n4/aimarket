/** Auto 模式下单个 Provider 尝试的最长等待（毫秒），超时后回落下一供应商 */
export function autoProviderAttemptTimeoutMs(): number {
  return Number(process.env.AUTO_PROVIDER_ATTEMPT_TIMEOUT_MS ?? 75_000);
}

/** 文生图 / 图生图 Provider 失败时是否值得尝试备用供应商（配额、上游 5xx、超时等） */
export function isRetriableGenerateProviderError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  const lower = message.toLowerCase();
  const name = err instanceof Error ? err.name.toLowerCase() : "";
  return (
    lower.includes("429") ||
    lower.includes("setlimitexceeded") ||
    lower.includes("rate limit") ||
    lower.includes("quota") ||
    lower.includes("paused") ||
    lower.includes("safe experience mode") ||
    lower.includes("推理上限") ||
    lower.includes("upstream_error") ||
    lower.includes("internalservererror") ||
    /\b50[023]\b/.test(lower) ||
    lower.includes("(500)") ||
    lower.includes("(502)") ||
    lower.includes("(503)") ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("超时") ||
    lower.includes("abort") ||
    name === "aborterror" ||
    name === "timeouterror" ||
    lower.includes("fetch failed") ||
    lower.includes("econnreset") ||
    lower.includes("etimedout") ||
    lower.includes("network")
  );
}
