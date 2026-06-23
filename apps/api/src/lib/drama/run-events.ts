import type { DramaRunGraph } from "./run-graph.js";

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

type RunEventListener = (event: DramaRunStreamEvent) => void;

const buffers = new Map<string, DramaRunStreamEvent[]>();
const listeners = new Map<string, Set<RunEventListener>>();

export function getRunEventBuffer(runId: string): DramaRunStreamEvent[] {
  return buffers.get(runId) ?? [];
}

export function publishRunEvent(runId: string, event: DramaRunStreamEvent) {
  const buf = buffers.get(runId) ?? [];
  buf.push(event);
  buffers.set(runId, buf);
  for (const listener of listeners.get(runId) ?? []) {
    listener(event);
  }
}

export function subscribeRunEvents(
  runId: string,
  listener: RunEventListener,
): () => void {
  const set = listeners.get(runId) ?? new Set();
  set.add(listener);
  listeners.set(runId, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(runId);
  };
}

export function clearRunEvents(runId: string) {
  buffers.delete(runId);
  listeners.delete(runId);
}

export function isTerminalRunEvent(event: DramaRunStreamEvent): boolean {
  return event.type === "run_complete" || event.type === "run_failed";
}
