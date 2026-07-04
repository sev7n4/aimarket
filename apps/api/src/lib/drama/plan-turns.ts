import { randomUUID } from "node:crypto";
import { db } from "../../db/index.js";

export type DramaPlanTurnKind = "initial" | "refine";

export interface DramaPlanTurnRow {
  id: string;
  session_id: string;
  user_id: string;
  project_id: string | null;
  plan_run_id: string | null;
  version_id: string | null;
  kind: string;
  instruction: string;
  assistant_ack: string | null;
  created_at: string;
}

export function createPlanTurn(input: {
  sessionId: string;
  userId: string;
  kind: DramaPlanTurnKind;
  instruction: string;
  planRunId?: string | null;
  projectId?: string | null;
  assistantAck?: string | null;
}): DramaPlanTurnRow {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO drama_plan_turns
       (id, session_id, user_id, project_id, plan_run_id, version_id,
        kind, instruction, assistant_ack, created_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, datetime('now'))`,
  ).run(
    id,
    input.sessionId,
    input.userId,
    input.projectId ?? null,
    input.planRunId ?? null,
    input.kind,
    input.instruction,
    input.assistantAck ?? null,
  );
  const row = db
    .prepare(`SELECT * FROM drama_plan_turns WHERE id = ?`)
    .get(id) as unknown as DramaPlanTurnRow;
  return row;
}

/** 规划/迭代完成后回填 project_id 与 version_id（通过 plan_run_id 定位对应回合）。 */
export function completePlanTurnByRun(
  planRunId: string,
  patch: { projectId?: string | null; versionId?: string | null },
): void {
  const sets: string[] = [];
  const params: (string | null)[] = [];
  if (patch.projectId !== undefined) {
    sets.push("project_id = ?");
    params.push(patch.projectId);
  }
  if (patch.versionId !== undefined) {
    sets.push("version_id = ?");
    params.push(patch.versionId);
  }
  if (sets.length === 0) return;
  params.push(planRunId);
  db.prepare(
    `UPDATE drama_plan_turns SET ${sets.join(", ")} WHERE plan_run_id = ?`,
  ).run(...params);
}

export function listPlanTurns(
  userId: string,
  sessionId: string,
): DramaPlanTurnRow[] {
  return db
    .prepare(
      `SELECT * FROM drama_plan_turns
       WHERE session_id = ? AND user_id = ?
       ORDER BY created_at ASC, rowid ASC`,
    )
    .all(sessionId, userId) as unknown as DramaPlanTurnRow[];
}

export function serializePlanTurn(row: DramaPlanTurnRow) {
  return {
    id: row.id,
    sessionId: row.session_id,
    projectId: row.project_id,
    planRunId: row.plan_run_id,
    versionId: row.version_id,
    kind: row.kind as DramaPlanTurnKind,
    instruction: row.instruction,
    assistantAck: row.assistant_ack ?? undefined,
    createdAt: row.created_at,
  };
}
