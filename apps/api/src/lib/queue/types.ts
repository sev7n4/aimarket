export interface JobQueuePayload {
  jobId: string;
  slideLabels?: string[];
}

export interface QueueStatus {
  mode: "memory" | "redis";
  redisConnected: boolean;
  pending?: number;
}
