import { resolveApiBase } from "@/lib/api-base";
import { fetchDramaPlanRun, getToken } from "./api-client";

const API_BASE = resolveApiBase();

export type DramaPlanStreamEvent =
  | { type: "agent_start"; agent: string }
  | { type: "agent_reasoning"; agent: string; chunk: string }
  | { type: "agent_done"; agent: string; summary: string }
  | {
      type: "plan_complete";
      projectId: string;
      estimatedPoints: number;
      dramaRunId?: string;
      produceSkippedReason?: string;
    }
  | { type: "plan_failed"; error: string };

const TERMINAL = new Set(["plan_complete", "plan_failed"]);

export function streamDramaPlanRun(
  runId: string,
  onEvent: (event: DramaPlanStreamEvent) => void,
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
        `${API_BASE}/api/v1/drama/plan/runs/${encodeURIComponent(runId)}/stream`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        },
      );
      if (!res.ok || !res.body) {
        throw new Error(`规划流连接失败 (${res.status})`);
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
          const parsed = JSON.parse(json) as DramaPlanStreamEvent;
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
        const latest = await fetchDramaPlanRun(runId);
        if (latest.status === "completed" || latest.status === "failed") {
          onDone();
          return;
        }
        onError(new Error("规划流已结束但未完成"));
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        onError(err instanceof Error ? err : new Error("规划流中断"));
      }
    }
  })();

  return () => controller.abort();
}

export function pollDramaPlanRun(
  runId: string,
  onUpdate: (run: Awaited<ReturnType<typeof fetchDramaPlanRun>>) => void,
  onDone: () => void,
  onError: (err: Error) => void,
): () => void {
  let cancelled = false;
  (async () => {
    for (let i = 0; i < 450 && !cancelled; i++) {
      try {
        const run = await fetchDramaPlanRun(runId);
        onUpdate(run);
        if (run.status === "completed" || run.status === "failed") {
          onDone();
          return;
        }
      } catch (err) {
        onError(err instanceof Error ? err : new Error("轮询失败"));
        return;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    onError(new Error("规划轮询超时"));
  })();
  return () => {
    cancelled = true;
  };
}
