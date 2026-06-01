import type { JobObservation } from "@aimarket/agent-core";
import { db } from "../../db/index.js";

export function buildJobObservation(jobId: string): JobObservation | null {
  const job = db
    .prepare(
      `SELECT id, status, error, points_cost, image_provider FROM generation_jobs WHERE id = ?`,
    )
    .get(jobId) as
    | {
        id: string;
        status: string;
        error: string | null;
        points_cost: number;
        image_provider: string | null;
      }
    | undefined;

  if (!job) return null;
  if (job.status !== "succeeded" && job.status !== "failed") return null;

  const outputs = db
    .prepare(
      `SELECT id, url FROM job_outputs WHERE job_id = ? ORDER BY sort_order ASC`,
    )
    .all(jobId) as Array<{ id: string; url: string }>;

  return {
    jobId,
    status: job.status === "succeeded" ? "succeeded" : "failed",
    outputIds: outputs.map((o) => o.id),
    urls: outputs.map((o) => o.url),
    error: job.error ?? undefined,
    pointsCost: job.points_cost,
    provider: job.image_provider ?? undefined,
  };
}
