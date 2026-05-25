import type { JobQueuePayload } from "./types.js";

type Processor = (payload: JobQueuePayload) => void | Promise<void>;

let processor: Processor | null = null;

export function registerMemoryProcessor(fn: Processor) {
  processor = fn;
}

export function enqueueMemory(payload: JobQueuePayload) {
  if (!processor) {
    console.warn("[queue:memory] processor not registered");
    return;
  }
  queueMicrotask(() => {
    void processor!(payload);
  });
}
