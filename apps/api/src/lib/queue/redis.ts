import type { JobQueuePayload, QueueStatus } from "./types.js";

const QUEUE_NAME = "aimarket-generation";

let redisConnected = false;
let pending = 0;

type Processor = (payload: JobQueuePayload) => Promise<void>;

export async function startRedisWorker(processor: Processor): Promise<boolean> {
  const url = process.env.REDIS_URL;
  if (!url) return false;

  try {
    const { Queue, Worker } = await import("bullmq");
    const connection = { url };

    const worker = new Worker<JobQueuePayload>(
      QUEUE_NAME,
      async (job) => {
        await processor(job.data);
      },
      { connection, concurrency: Number(process.env.JOB_CONCURRENCY ?? 2) },
    );

    worker.on("completed", () => {
      pending = Math.max(0, pending - 1);
    });
    worker.on("failed", (job, err) => {
      pending = Math.max(0, pending - 1);
      console.error("[queue:redis] job failed", job?.id, err);
    });

    redisConnected = true;
    console.log("[queue:redis] worker started");
    return true;
  } catch (err) {
    console.error("[queue:redis] failed to start", err);
    return false;
  }
}

export async function enqueueRedis(payload: JobQueuePayload): Promise<boolean> {
  const url = process.env.REDIS_URL;
  if (!url) return false;

  try {
    const { Queue } = await import("bullmq");
    const queue = new Queue<JobQueuePayload>(QUEUE_NAME, {
      connection: { url },
    });
    await queue.add("generate", payload, {
      removeOnComplete: 100,
      removeOnFail: 50,
    });
    pending += 1;
    redisConnected = true;
    return true;
  } catch (err) {
    console.error("[queue:redis] enqueue failed", err);
    return false;
  }
}

export function getRedisQueueStatus(): QueueStatus {
  return {
    mode: "redis",
    redisConnected,
    pending,
  };
}
