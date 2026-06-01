import { randomUUID } from "node:crypto";
import type { SQLInputValue } from "node:sqlite";
import type { AgentPlan, AgentRunStatus, JobObservation } from "@aimarket/agent-core";
import { db } from "../../db/index.js";
import { AppError } from "../errors.js";

export interface AgentRunRow {
  id: string;
  session_id: string;
  user_id: string;
  status: AgentRunStatus;
  prompt: string;
  mode: string;
  plan_json: string | null;
  current_step_index: number;
  pending_job_id: string | null;
  state_json: string | null;
  plan_source: string | null;
  skill_id: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export function createAgentRun(input: {
  sessionId: string;
  userId: string;
  prompt: string;
  mode: string;
}): AgentRunRow {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO agent_runs
     (id, session_id, user_id, status, prompt, mode, current_step_index, created_at, updated_at)
     VALUES (?, ?, ?, 'planning', ?, ?, 0, datetime('now'), datetime('now'))`,
  ).run(id, input.sessionId, input.userId, input.prompt, input.mode);

  const row = getAgentRun(input.userId, id);
  if (!row) {
    throw new AppError(500, "INTERNAL_ERROR", "创建 Agent Run 失败");
  }
  return row;
}

export function getAgentRun(
  userId: string,
  runId: string,
): AgentRunRow | undefined {
  return db
    .prepare(
      `SELECT * FROM agent_runs WHERE id = ? AND user_id = ?`,
    )
    .get(runId, userId) as AgentRunRow | undefined;
}

export function updateAgentRun(
  runId: string,
  patch: Partial<{
    status: AgentRunStatus;
    plan: AgentPlan | null;
    currentStepIndex: number;
    pendingJobId: string | null;
    stateJson: string | null;
    planSource: string | null;
    skillId: string | null;
    error: string | null;
  }>,
) {
  const sets: string[] = ["updated_at = datetime('now')"];
  const params: SQLInputValue[] = [];

  if (patch.status !== undefined) {
    sets.push("status = ?");
    params.push(patch.status);
  }
  if (patch.plan !== undefined) {
    sets.push("plan_json = ?");
    params.push(patch.plan ? JSON.stringify(patch.plan) : null);
  }
  if (patch.currentStepIndex !== undefined) {
    sets.push("current_step_index = ?");
    params.push(patch.currentStepIndex);
  }
  if (patch.pendingJobId !== undefined) {
    sets.push("pending_job_id = ?");
    params.push(patch.pendingJobId);
  }
  if (patch.stateJson !== undefined) {
    sets.push("state_json = ?");
    params.push(patch.stateJson);
  }
  if (patch.planSource !== undefined) {
    sets.push("plan_source = ?");
    params.push(patch.planSource);
  }
  if (patch.skillId !== undefined) {
    sets.push("skill_id = ?");
    params.push(patch.skillId);
  }
  if (patch.error !== undefined) {
    sets.push("error = ?");
    params.push(patch.error);
  }

  params.push(runId);
  db.prepare(`UPDATE agent_runs SET ${sets.join(", ")} WHERE id = ?`).run(
    ...params,
  );
}

export function linkAgentRunJob(runId: string, jobId: string, stepIndex: number) {
  db.prepare(
    `INSERT OR IGNORE INTO agent_run_jobs (run_id, job_id, step_index) VALUES (?, ?, ?)`,
  ).run(runId, jobId, stepIndex);
}

export function findAgentRunByJobId(jobId: string): {
  run: AgentRunRow;
  stepIndex: number;
} | null {
  const link = db
    .prepare(
      `SELECT run_id, step_index FROM agent_run_jobs WHERE job_id = ?`,
    )
    .get(jobId) as { run_id: string; step_index: number } | undefined;
  if (!link) return null;

  const run = db
    .prepare(`SELECT * FROM agent_runs WHERE id = ?`)
    .get(link.run_id) as AgentRunRow | undefined;
  if (!run) return null;
  return { run, stepIndex: link.step_index };
}

export function parseAgentRunStateJson(row: AgentRunRow): {
  observations: JobObservation[];
  stepRetries: Record<number, number>;
} {
  if (!row.state_json) {
    return { observations: [], stepRetries: {} };
  }
  try {
    const parsed = JSON.parse(row.state_json) as {
      observations?: JobObservation[];
      stepRetries?: Record<number, number>;
    };
    return {
      observations: parsed.observations ?? [],
      stepRetries: parsed.stepRetries ?? {},
    };
  } catch {
    return { observations: [], stepRetries: {} };
  }
}

export function parseAgentRunPlan(row: AgentRunRow): AgentPlan | null {
  if (!row.plan_json) return null;
  try {
    return JSON.parse(row.plan_json) as AgentPlan;
  } catch {
    return null;
  }
}

export function serializeRunForApi(
  row: AgentRunRow,
  observations: JobObservation[] = [],
) {
  return {
    id: row.id,
    sessionId: row.session_id,
    status: row.status,
    prompt: row.prompt,
    mode: row.mode,
    plan: parseAgentRunPlan(row),
    currentStepIndex: row.current_step_index,
    pendingJobId: row.pending_job_id,
    planSource: row.plan_source,
    skillId: row.skill_id,
    error: row.error,
    observations,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
