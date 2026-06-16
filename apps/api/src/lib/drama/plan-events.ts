import type { DramaPlanEvent } from "./planner/types.js";

type PlanEventListener = (event: DramaPlanEvent) => void;

const buffers = new Map<string, DramaPlanEvent[]>();
const listeners = new Map<string, Set<PlanEventListener>>();

export function getPlanEventBuffer(runId: string): DramaPlanEvent[] {
  return buffers.get(runId) ?? [];
}

export function publishPlanEvent(runId: string, event: DramaPlanEvent) {
  const buf = buffers.get(runId) ?? [];
  buf.push(event);
  buffers.set(runId, buf);
  for (const listener of listeners.get(runId) ?? []) {
    listener(event);
  }
}

export function subscribePlanEvents(
  runId: string,
  listener: PlanEventListener,
): () => void {
  const set = listeners.get(runId) ?? new Set();
  set.add(listener);
  listeners.set(runId, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(runId);
  };
}

export function clearPlanEvents(runId: string) {
  buffers.delete(runId);
  listeners.delete(runId);
}

export function isTerminalPlanEvent(event: DramaPlanEvent): boolean {
  return event.type === "plan_complete" || event.type === "plan_failed";
}
