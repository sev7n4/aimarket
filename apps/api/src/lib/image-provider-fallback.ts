/** 文生图 / 图生图 Provider 失败时是否值得尝试备用供应商（配额、上游 5xx 等） */
export function isRetriableGenerateProviderError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  const lower = message.toLowerCase();
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
    lower.includes("(503)")
  );
}
