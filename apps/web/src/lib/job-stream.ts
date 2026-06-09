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
  queueAhead?: number | null;
}

const TERMINAL = new Set(["succeeded", "failed"]);
const POLL_INTERVAL_MS = 1500;
/** 15 分钟：Auto 多供应商回落时单 job 可能超过 3 分钟 */
const POLL_MAX_ATTEMPTS = 600;

export const JOB_STREAM_STILL_RUNNING_HINT =
  "生成仍在进行，正在继续等待结果…";
export const JOB_STREAM_LISTEN_TIMEOUT_HINT =
  "前端监听已达 15 分钟，任务可能仍在后台执行；请刷新页面查看，超时任务将自动失败并退回积分";
export const JOB_STREAM_DISCONNECTED_HINT =
  "任务连接中断，请刷新页面查看是否已完成；若长时间无结果将自动超时退积分";

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
    let terminal = false;
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
              terminal = true;
              onDone();
              return;
            }
          }
        }
      }
      if (!terminal) {
        onError(new Error("SSE 已结束但任务未完成"));
        return;
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
            queueAhead: job.queue_ahead ?? null,
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
    if (cancelled) return;
    try {
      const job = await fetchJob(jobId);
      if (TERMINAL.has(job.status)) {
        onEvent({
          status: job.status,
          error: job.error,
          outputs: job.outputs,
          count: job.count,
          completed: job.outputs?.length ?? 0,
          queueAhead: job.queue_ahead ?? null,
        });
        onDone();
        return;
      }
    } catch {
      /* 最终探测失败则走超时 */
    }
    onError(new Error(JOB_STREAM_LISTEN_TIMEOUT_HINT));
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

  const startPollFallback = () => {
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
  };

  const streamStop = streamJob(
    jobId,
    onEvent,
    finish,
    () => {
      startPollFallback();
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
