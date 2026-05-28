import { db } from "../db/index.js";

export interface JobLineageResolveInput {
  parentJobId?: string | null;
  sourceOutputId?: string | null;
  referenceOutputIds?: string[];
}

/** 从显式字段或 reference output 解析 job 血缘 */
export function resolveJobLineage(
  input: JobLineageResolveInput,
): { parentJobId: string | null; sourceOutputId: string | null } {
  if (input.parentJobId || input.sourceOutputId) {
    return {
      parentJobId: input.parentJobId ?? null,
      sourceOutputId: input.sourceOutputId ?? null,
    };
  }

  const refId = input.referenceOutputIds?.[0];
  if (!refId) {
    return { parentJobId: null, sourceOutputId: null };
  }

  const fromJob = db
    .prepare(`SELECT job_id FROM job_outputs WHERE id = ?`)
    .get(refId) as { job_id: string } | undefined;
  if (fromJob) {
    return { parentJobId: fromJob.job_id, sourceOutputId: refId };
  }

  const fromMessage = db
    .prepare(
      `SELECT m.job_id
       FROM message_outputs mo
       JOIN messages m ON m.id = mo.message_id
       WHERE mo.id = ?`,
    )
    .get(refId) as { job_id: string | null } | undefined;
  if (fromMessage?.job_id) {
    return { parentJobId: fromMessage.job_id, sourceOutputId: refId };
  }

  return { parentJobId: null, sourceOutputId: refId };
}
