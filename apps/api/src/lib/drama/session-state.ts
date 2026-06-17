import { db } from "../../db/index.js";
import {
  getDramaPlanRun,
  serializeDramaPlanRun,
  type DramaPlanRunRow,
} from "./plan-runs.js";
import {
  getDramaProject,
  serializeDramaProject,
} from "./projects.js";
import {
  getDramaRun,
  serializeDramaRun,
  type DramaRunRow,
} from "./runs.js";

const ACTIVE_RUN_STATUSES = new Set([
  "planning",
  "waiting_confirm",
  "queued",
  "running",
  "waiting_job",
]);

function latestPlanRunRow(
  userId: string,
  sessionId: string,
): DramaPlanRunRow | undefined {
  return db
    .prepare(
      `SELECT * FROM drama_plan_runs
       WHERE session_id = ? AND user_id = ?
       ORDER BY updated_at DESC LIMIT 1`,
    )
    .get(sessionId, userId) as DramaPlanRunRow | undefined;
}

function latestRunRow(
  userId: string,
  sessionId: string,
): DramaRunRow | undefined {
  return db
    .prepare(
      `SELECT * FROM drama_runs
       WHERE session_id = ? AND user_id = ?
       ORDER BY updated_at DESC LIMIT 1`,
    )
    .get(sessionId, userId) as DramaRunRow | undefined;
}

export function serializeDramaSessionState(userId: string, sessionId: string) {
  const planRow = latestPlanRunRow(userId, sessionId);
  const runRow = latestRunRow(userId, sessionId);

  const planRun = planRow ? serializeDramaPlanRun(planRow) : undefined;

  let dramaRun:
    | ReturnType<typeof serializeDramaRun>
    | undefined;
  if (runRow) {
    const projectRow = getDramaProject(userId, runRow.project_id);
    if (projectRow) {
      const shouldExpose =
        ACTIVE_RUN_STATUSES.has(runRow.status) ||
        runRow.status === "failed" ||
        runRow.status === "completed";
      if (shouldExpose) {
        dramaRun = serializeDramaRun(runRow, projectRow);
      }
    }
  }

  let draftProject:
    | ReturnType<typeof serializeDramaProject>
    | undefined;
  if (
    planRow?.status === "completed" &&
    planRow.project_id &&
    (!runRow || !ACTIVE_RUN_STATUSES.has(runRow.status))
  ) {
    const projectRow = getDramaProject(userId, planRow.project_id);
    if (
      projectRow &&
      (projectRow.status === "waiting_confirm" ||
        projectRow.status === "drafting")
    ) {
      draftProject = serializeDramaProject(projectRow);
    }
  }

  return {
    sessionId,
    planRun,
    dramaRun,
    draftProject,
  };
}

export function getDramaSessionPlanRun(
  userId: string,
  sessionId: string,
  runId: string,
) {
  const row = getDramaPlanRun(userId, runId);
  if (!row || row.session_id !== sessionId) return undefined;
  return serializeDramaPlanRun(row);
}

export function getDramaSessionRun(
  userId: string,
  sessionId: string,
  runId: string,
) {
  const row = getDramaRun(userId, runId);
  if (!row || row.session_id !== sessionId) return undefined;
  const projectRow = getDramaProject(userId, row.project_id);
  if (!projectRow) return undefined;
  return serializeDramaRun(row, projectRow);
}
