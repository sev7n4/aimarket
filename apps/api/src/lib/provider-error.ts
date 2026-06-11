/** 将上游 provider 返回的 error 字段格式化为可读字符串 */
export function formatProviderError(error: unknown): string {
  if (error == null) return "unknown";
  if (typeof error === "string") {
    const trimmed = error.trim();
    return trimmed || "unknown";
  }
  if (error instanceof Error) return error.message || "unknown";
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
