import { resolveApiBase } from "@/lib/api-base";
import { fetchDramaRun, getToken } from "./api-client";
import type { DramaRunGraph } from "./types";

const API_BASE = resolveApiBase();

export type DramaRunStreamEvent =
  | {
      type: "graph_update";
      runId: string;
      status: string;
      currentStepIndex: number;
      graph: DramaRunGraph;
    }
  | { type: "run_complete"; runId: string }
  | { type: "run_failed"; runId: string; error: string };

const TERMINAL = new Set(["run_complete", "run_failed"]);

export function streamDramaRun(
  runId: string,
  onEvent: (event: DramaRunStreamEvent) => void,
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
      const res = await fetch(
        `${API_BASE}/api/v1/drama/runs/${encodeURIComponent(runId)}/stream`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        },
      );
      if (!res.ok || !res.body) {
        throw new Error(`制作流连接失败 (${res.status})`);
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
          const dataLine = part.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          const json = dataLine.slice(5).trim();
          if (!json) continue;
          const parsed = JSON.parse(json) as DramaRunStreamEvent;
          if (parsed.type) {
            onEvent(parsed);
            if (TERMINAL.has(parsed.type)) {
              terminal = true;
              onDone();
              return;
            }
          }
        }
      }
      if (!terminal) {
        const latest = await fetchDramaRun(runId);
        if (
          latest.status === "completed" ||
          latest.status === "failed" ||
          latest.status === "cancelled"
        ) {
          onDone();
          return;
        }
        onError(new Error("制作流已结束但未完成"));
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        onError(err instanceof Error ? err : new Error("制作流中断"));
      }
    }
  })();

  return () => controller.abort();
}

export function pollDramaRunUpdates(
  runId: string,
  onUpdate: (run: Awaited<ReturnType<typeof fetchDramaRun>>) => void,
  onDone: () => void,
  onError: (err: Error) => void,
): () => void {
  let cancelled = false;
  (async () => {
    for (let i = 0; i < 1200 && !cancelled; i++) {
      try {
        const run = await fetchDramaRun(runId);
        onUpdate(run);
        if (
          run.status === "completed" ||
          run.status === "failed" ||
          run.status === "cancelled"
        ) {
          onDone();
          return;
        }
      } catch (err) {
        onError(err instanceof Error ? err : new Error("轮询失败"));
        return;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    onError(new Error("制作轮询超时"));
  })();
  return () => {
    cancelled = true;
  };
}
