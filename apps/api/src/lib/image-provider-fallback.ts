/** 图生图 Provider 失败时是否值得尝试备用供应商（如 Seedream 429 配额） */
export function isRetriableI2iProviderError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  const lower = message.toLowerCase();
  return (
    lower.includes("429") ||
    lower.includes("setlimitexceeded") ||
    lower.includes("rate limit") ||
    lower.includes("quota") ||
    lower.includes("paused") ||
    lower.includes("safe experience mode") ||
    lower.includes("推理上限")
  );
}
