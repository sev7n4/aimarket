import { db } from "../../db/index.js";

export interface DramaTurnaroundJobRow {
  job_id: string;
  project_id: string;
  user_id: string;
  character_id: string;
  angle: string;
}

export function linkDramaTurnaroundJob(input: {
  jobId: string;
  projectId: string;
  userId: string;
  characterId: string;
  angle: string;
}) {
  db.prepare(
    `INSERT OR REPLACE INTO drama_turnaround_jobs
     (job_id, project_id, user_id, character_id, angle)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    input.jobId,
    input.projectId,
    input.userId,
    input.characterId,
    input.angle,
  );
}

export function getDramaTurnaroundJobByJobId(
  jobId: string,
): DramaTurnaroundJobRow | undefined {
  return db
    .prepare(
      `SELECT job_id, project_id, user_id, character_id, angle
       FROM drama_turnaround_jobs WHERE job_id = ?`,
    )
    .get(jobId) as DramaTurnaroundJobRow | undefined;
}

export function deleteDramaTurnaroundJob(jobId: string) {
  db.prepare(`DELETE FROM drama_turnaround_jobs WHERE job_id = ?`).run(jobId);
}

export function countPendingTurnaroundJobs(
  projectId: string,
  characterId: string,
): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM drama_turnaround_jobs
       WHERE project_id = ? AND character_id = ?`,
    )
    .get(projectId, characterId) as { c: number };
  return row.c;
}
