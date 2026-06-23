import { db } from "../../db/index.js";
import { buildDramaRunGraph } from "./run-graph.js";
import {
  getRunEventBuffer,
  isTerminalRunEvent,
  publishRunEvent,
} from "./run-events.js";
import type { DramaProjectRow } from "./projects.js";
import type { DramaRunRow } from "./runs.js";

function getDramaRunRow(runId: string): DramaRunRow | undefined {
  return db
    .prepare(`SELECT * FROM drama_runs WHERE id = ?`)
    .get(runId) as DramaRunRow | undefined;
}

function getDramaProjectRowById(
  projectId: string,
): DramaProjectRow | undefined {
  return db
    .prepare(`SELECT * FROM drama_projects WHERE id = ?`)
    .get(projectId) as DramaProjectRow | undefined;
}

/** 推送制作 DAG 图与终态事件（PROD-B02） */
export function publishDramaRunStreamUpdate(runId: string) {
  const row = getDramaRunRow(runId);
  if (!row) return;

  const projectRow = getDramaProjectRowById(row.project_id);
  if (!projectRow) return;

  const graph = buildDramaRunGraph(row, projectRow);
  publishRunEvent(runId, {
    type: "graph_update",
    runId,
    status: row.status,
    currentStepIndex: row.current_step_index,
    graph,
  });

  const buf = getRunEventBuffer(runId);
  if (buf.some(isTerminalRunEvent)) return;

  if (row.status === "completed") {
    publishRunEvent(runId, { type: "run_complete", runId });
  } else if (row.status === "failed") {
    publishRunEvent(runId, {
      type: "run_failed",
      runId,
      error: row.error ?? "制作失败",
    });
  }
}
