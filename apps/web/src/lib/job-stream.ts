import { resolveApiBase } from "@/lib/api-base";
import { fetchJob, getToken } from "./api-client";

const API_BASE = resolveApiBase();

export interface JobStreamEvent {
  status: string;
  error?: string | null;
  outputs?: { url: string; sort_order: number }[];
  outputType?: string;
  count?: number;
  completed?: number;
}

const TERMINAL = new Set(["succeeded", "failed"]);
const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 120;

/** 默认 SSE；设 NEXT_PUBLIC_USE_JOB_STREAM=false 则仅轮询 */
export function shouldUseJobStream(): boolean {
  return process.env.NEXT_PUBLIC_USE_JOB_STREAM !== "false";
}

export function streamJob(
  jobId: string,
  onEvent: (event: JobStreamEvent) => void,
  onDone: () => void,
  onError: (err: Error) => void,
) {
  const token = getToken();
  if (!token) {
    onError(new Error("未登录"));
    return () => {};
  }

  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/ai/jobs/${jobId}/stream`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`流连接失败 (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const dataLine = part
            .split("\n")
            .find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          const json = dataLine.slice(5).trim();
          if (!json) continue;
          const parsed = JSON.parse(json) as JobStreamEvent & {
            status?: string;
          };
          if (parsed.status) {
            onEvent(parsed as JobStreamEvent);
            if (TERMINAL.has(parsed.status)) {
              onDone();
              return;
            }
          }
        }
      }
      onDone();
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        onError(err instanceof Error ? err : new Error("流中断"));
      }
    }
  })();

  return () => controller.abort();
}

function pollJob(
  jobId: string,
  onEvent: (event: JobStreamEvent) => void,
  onDone: () => void,
  onError: (err: Error) => void,
): () => void {
  let cancelled = false;
  let lastStatus = "";
  let lastOutputCount = -1;

  (async () => {
    for (let i = 0; i < POLL_MAX_ATTEMPTS && !cancelled; i++) {
      try {
        const job = await fetchJob(jobId);
        const outputCount = job.outputs?.length ?? 0;
        if (job.status !== lastStatus || outputCount !== lastOutputCount) {
          lastStatus = job.status;
          lastOutputCount = outputCount;
          onEvent({
            status: job.status,
            error: job.error,
            outputs: job.outputs,
            count: job.count,
            completed: outputCount,
          });
        }
        if (TERMINAL.has(job.status)) {
          onDone();
          return;
        }
      } catch (err) {
        onError(err instanceof Error ? err : new Error("轮询失败"));
        return;
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    onError(new Error("任务超时"));
  })();

  return () => {
    cancelled = true;
  };
}

/**
 * 默认 SSE；连接失败时自动降级为 GET /ai/jobs/:id 轮询。
 * USE_JOB_STREAM=false 时跳过 SSE，直接轮询。
 */
export function watchJob(
  jobId: string,
  onEvent: (event: JobStreamEvent) => void,
  onDone: () => void,
  onError: (err: Error) => void,
): () => void {
  if (!shouldUseJobStream()) {
    return pollJob(jobId, onEvent, onDone, onError);
  }

  let finished = false;
  let pollStop: (() => void) | null = null;

  const finish = () => {
    if (finished) return;
    finished = true;
    onDone();
  };

  const streamStop = streamJob(
    jobId,
    onEvent,
    finish,
    () => {
      if (finished) return;
      pollStop = pollJob(
        jobId,
        onEvent,
        finish,
        (pollErr) => {
          if (!finished) {
            finished = true;
            onError(pollErr);
          }
        },
      );
    },
  );

  return () => {
    finished = true;
    streamStop();
    pollStop?.();
  };
}

export function jobStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "queued":
      return "排队中…";
    case "running":
      return "生成中…";
    case "succeeded":
      return "生成完成";
    case "failed":
      return "生成失败";
    default:
      return "处理中…";
  }
}
