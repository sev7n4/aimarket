import { resolveApiBase } from "@/lib/api-base";
import { getToken } from "./api-client";

const API_BASE = resolveApiBase();

export interface JobStreamEvent {
  status: string;
  error?: string | null;
  outputs?: { url: string; sort_order: number }[];
  outputType?: string;
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
          const parsed = JSON.parse(json) as JobStreamEvent & { status?: string };
          if (parsed.status) {
            onEvent(parsed as JobStreamEvent);
            if (parsed.status === "succeeded" || parsed.status === "failed") {
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
