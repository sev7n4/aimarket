import { MoyuTimeoutError } from "./errors.js";
import type { PollOptions } from "./types.js";

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 分钟
const DEFAULT_POLL_INTERVAL_MS = 3000;

/** 终态判定 — 命中即结束轮询 */
const TERMINAL_STATUSES = new Set([
  "completed",
  "failed",
  "cancelled",
  "succeeded",
]);

export function isTerminalStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return TERMINAL_STATUSES.has(status);
}

/** 睡眠工具，支持 AbortSignal 提前中断 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("aborted"));
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error("aborted"));
    };
    function cleanup() {
      signal?.removeEventListener("abort", onAbort);
    }
    signal?.addEventListener("abort", onAbort);
  });
}

/**
 * 通用轮询循环。在每次 tick 中调用 fetchStatus，若返回值 isTerminalStatus 则结束。
 *
 * @param fetchStatus 返回当前状态的 async 函数
 * @param opts 轮询选项
 * @returns 最终状态字符串
 */
export async function pollUntilTerminal(
  fetchStatus: () => Promise<string | null>,
  opts: PollOptions = {},
): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const signal = opts.signal;
  const deadline = Date.now() + timeoutMs;
  let lastStatus: string | null = null;

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new Error("aborted");
    }
    try {
      lastStatus = await fetchStatus();
    } catch (err) {
      // 网络错误时记录但继续轮询（除非超时）
      if (opts.onProgress) opts.onProgress("error");
    }
    if (lastStatus && isTerminalStatus(lastStatus)) {
      return lastStatus;
    }
    if (opts.onProgress && lastStatus) {
      opts.onProgress(lastStatus);
    }
    try {
      await sleep(pollIntervalMs, signal);
    } catch {
      break;
    }
  }
  throw new MoyuTimeoutError(
    `等待超过 ${timeoutMs}ms（最近状态：${lastStatus ?? "未知"}）`,
    lastStatus,
  );
}
