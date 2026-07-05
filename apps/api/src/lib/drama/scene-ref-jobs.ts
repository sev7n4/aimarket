import { db } from "../../db/index.js";

export interface DramaSceneRefJobRow {
  job_id: string;
  project_id: string;
  user_id: string;
  scene_id: string;
}

export function linkDramaSceneRefJob(input: {
  jobId: string;
  projectId: string;
  userId: string;
  sceneId: string;
}) {
  db.prepare(
    `INSERT OR REPLACE INTO drama_scene_ref_jobs
     (job_id, project_id, user_id, scene_id)
     VALUES (?, ?, ?, ?)`,
  ).run(input.jobId, input.projectId, input.userId, input.sceneId);
}

export function getDramaSceneRefJobByJobId(
  jobId: string,
): DramaSceneRefJobRow | undefined {
  return db
    .prepare(
      `SELECT job_id, project_id, user_id, scene_id
       FROM drama_scene_ref_jobs WHERE job_id = ?`,
    )
    .get(jobId) as DramaSceneRefJobRow | undefined;
}

export function deleteDramaSceneRefJob(jobId: string) {
  db.prepare(`DELETE FROM drama_scene_ref_jobs WHERE job_id = ?`).run(jobId);
}

export function countPendingSceneRefJobs(
  projectId: string,
  sceneId: string,
): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM drama_scene_ref_jobs
       WHERE project_id = ? AND scene_id = ?`,
    )
    .get(projectId, sceneId) as { c: number };
  return row.c;
}
