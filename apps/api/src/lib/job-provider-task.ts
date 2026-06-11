import { db } from "../db/index.js";

/** 视频等异步任务创建后，持久化上游 task id 便于排障与 admin probe */
export function setJobProviderTaskId(
  jobId: string | undefined,
  providerTaskId: string,
): void {
  const id = providerTaskId.trim();
  if (!jobId || !id) return;
  db.prepare(
    `UPDATE generation_jobs SET provider_task_id = ? WHERE id = ?`,
  ).run(id, jobId);
}
