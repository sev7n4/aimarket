import { enqueueMemory, registerMemoryProcessor } from "./memory.js";
import {
  enqueueRedis,
  getRedisQueueStatus,
  startRedisWorker,
} from "./redis.js";
import type { JobQueuePayload, QueueStatus } from "./types.js";

type Processor = (payload: JobQueuePayload) => Promise<void>;

let mode: "memory" | "redis" = "memory";
let started = false;

export function resolveQueueMode(): "memory" | "redis" {
  const env = process.env.JOB_QUEUE ?? "memory";
  if (env === "redis" && process.env.REDIS_URL) return "redis";
  return "memory";
}

export async function startJobQueue(processor: Processor) {
  if (started) return;
  started = true;
  mode = resolveQueueMode();

  registerMemoryProcessor((payload) => {
    void processor(payload);
  });

  if (mode === "redis") {
    const ok = await startRedisWorker(processor);
    if (!ok) {
      console.warn("[queue] redis unavailable, falling back to memory");
      mode = "memory";
    }
  } else {
    console.log("[queue:memory] active");
  }
}

export async function enqueueJob(payload: JobQueuePayload) {
  if (mode === "redis") {
    const ok = await enqueueRedis(payload);
    if (ok) return;
  }
  enqueueMemory(payload);
}

export function getQueueStatus(): QueueStatus {
  if (mode === "redis") return getRedisQueueStatus();
  return { mode: "memory", redisConnected: false };
}
