/**
 * 魔术棒个性化：本地记录用户近期"采纳"的润色结果，
 * 作为后端 few-shot 风格参考，实现千人千面。
 */
const KEY = "aimarket.prompt.recentAccepted";
const MAX_STORE = 5;
const MAX_LEN = 400;

function readRaw(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

/** 读取最近采纳的润色结果（最新在前），最多 limit 条 */
export function readRecentAcceptedPrompts(limit = 3): string[] {
  return readRaw().slice(0, Math.max(0, limit));
}

/** 记录一条被采纳的润色结果：去重、截断、置顶、限量 */
export function recordAcceptedPrompt(prompt: string): void {
  if (typeof window === "undefined") return;
  const trimmed = prompt.trim().slice(0, MAX_LEN);
  if (!trimmed) return;
  const next = [trimmed, ...readRaw().filter((v) => v !== trimmed)].slice(
    0,
    MAX_STORE,
  );
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
