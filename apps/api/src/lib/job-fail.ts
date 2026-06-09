import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { recordAnalyticsEvent } from "./analytics.js";
import { notifyAgentJobCompleted } from "./agent/job-events.js";

/** 将任务标记失败、退积分、写 assistant 消息并通知 Agent */
export function markGenerationJobFailed(
  jobId: string,
  message: string,
  errorCode = "GENERATION_ERROR",
): boolean {
  const job = db
    .prepare(
      `SELECT id, session_id, user_id, status, points_cost, created_at
       FROM generation_jobs WHERE id = ?`,
    )
    .get(jobId) as
    | {
        id: string;
        session_id: string;
        user_id: string;
        status: string;
        points_cost: number;
        created_at: string;
      }
    | undefined;

  if (!job || job.status === "succeeded" || job.status === "failed") {
    return false;
  }

  const startedMs = Date.parse(
    job.created_at.includes("T")
      ? job.created_at
      : `${job.created_at.replace(" ", "T")}Z`,
  );
  const durationMs = Number.isNaN(startedMs)
    ? 0
    : Math.max(0, Date.now() - startedMs);

  recordAnalyticsEvent(job.user_id, "generation_fail", {
    job_id: jobId,
    error_code: errorCode,
    duration_ms: durationMs,
  });

  db.transaction(() => {
    db.prepare(
      `UPDATE generation_jobs SET status = 'failed', error = ?, completed_at = datetime('now') WHERE id = ?`,
    ).run(message, jobId);
    db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(
      job.points_cost,
      job.user_id,
    );
    db.prepare(
      `UPDATE image_sessions SET status = 'idle', updated_at = datetime('now') WHERE id = ?`,
    ).run(job.session_id);
    db.prepare(
      `INSERT INTO messages (id, session_id, role, content, job_id)
       VALUES (?, ?, 'assistant', ?, ?)`,
    ).run(
      randomUUID(),
      job.session_id,
      `生成失败：${message}，积分已退回。`,
      jobId,
    );
  });
  notifyAgentJobCompleted(jobId);
  return true;
}
