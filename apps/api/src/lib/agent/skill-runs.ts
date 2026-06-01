import { randomUUID } from "node:crypto";
import { loadSkill, type SkillDefinition } from "@aimarket/agent-skills";
import { ECOMMERCE_SLIDES } from "../ecommerce.js";
import { estimatePoints, estimateToolPoints } from "../pricing.js";
import { suggestModel } from "../router.js";
import { db } from "../../db/index.js";
import { AppError } from "../errors.js";

export type SkillRunStatus =
  | "queued"
  | "waiting_confirm"
  | "running"
  | "waiting_job"
  | "completed"
  | "failed"
  | "cancelled";

export interface SkillStepOutput {
  jobId: string;
  outputIds: string[];
  urls: string[];
  /** VLM 为套图步骤选定的主图索引（P3.2） */
  heroOutputIndex?: number;
}

export interface SkillStepOutputs {
  [stepId: string]: SkillStepOutput;
}

export interface SkillRunRow {
  id: string;
  session_id: string;
  user_id: string;
  skill_id: string;
  skill_version: number;
  status: SkillRunStatus;
  prompt: string;
  inputs_json: string | null;
  current_step_index: number;
  pending_job_id: string | null;
  step_outputs_json: string | null;
  estimated_points: number;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export function estimateSkillPoints(skill: SkillDefinition): number {
  const route = suggestModel("ecommerce", "");
  let total = 0;
  for (const step of skill.steps) {
    if (step.type === "generate_set") {
      total += estimatePoints(route.modelId, ECOMMERCE_SLIDES.length, "2k");
    } else if (step.type === "tool") {
      total += estimateToolPoints(step.toolId, "2k", 1);
    } else if (step.type === "video") {
      total += estimatePoints(step.modelId, 1, step.resolution);
    }
  }
  return total;
}

export function createSkillRun(input: {
  sessionId: string;
  userId: string;
  skillId: string;
  prompt: string;
  productAssetId?: string;
  referenceAssetId?: string;
  confirmed?: boolean;
}): { row: SkillRunRow; skill: SkillDefinition } {
  const skill = loadSkill(input.skillId);
  const estimated = estimateSkillPoints(skill);
  const requiresConfirm =
    estimated >= skill.confirmIfPointsOver && !input.confirmed;

  const id = randomUUID();
  const status: SkillRunStatus = requiresConfirm ? "waiting_confirm" : "queued";

  db.prepare(
    `INSERT INTO skill_runs
     (id, session_id, user_id, skill_id, skill_version, status, prompt, inputs_json,
      current_step_index, estimated_points, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'), datetime('now'))`,
  ).run(
    id,
    input.sessionId,
    input.userId,
    skill.id,
    skill.version,
    status,
    input.prompt,
    JSON.stringify({
      productAssetId: input.productAssetId,
      referenceAssetId: input.referenceAssetId,
    }),
    estimated,
  );

  const row = getSkillRun(input.userId, id);
  if (!row) {
    throw new AppError(500, "INTERNAL_ERROR", "创建 Skill Run 失败");
  }
  return { row, skill };
}

export function getSkillRun(
  userId: string,
  runId: string,
): SkillRunRow | undefined {
  return db
    .prepare(`SELECT * FROM skill_runs WHERE id = ? AND user_id = ?`)
    .get(runId, userId) as SkillRunRow | undefined;
}

export function getSkillRunByJobId(jobId: string): SkillRunRow | undefined {
  const link = db
    .prepare(`SELECT skill_run_id FROM skill_run_jobs WHERE job_id = ?`)
    .get(jobId) as { skill_run_id: string } | undefined;
  if (!link) return undefined;
  return db
    .prepare(`SELECT * FROM skill_runs WHERE id = ?`)
    .get(link.skill_run_id) as SkillRunRow | undefined;
}

export function parseStepOutputs(row: SkillRunRow): SkillStepOutputs {
  if (!row.step_outputs_json) return {};
  try {
    return JSON.parse(row.step_outputs_json) as SkillStepOutputs;
  } catch {
    return {};
  }
}

export function updateSkillRun(
  runId: string,
  patch: Partial<{
    status: SkillRunStatus;
    currentStepIndex: number;
    pendingJobId: string | null;
    stepOutputs: SkillStepOutputs;
    error: string | null;
  }>,
) {
  const sets = ["updated_at = datetime('now')"];
  const params: (string | number | null)[] = [];

  if (patch.status !== undefined) {
    sets.push("status = ?");
    params.push(patch.status);
  }
  if (patch.currentStepIndex !== undefined) {
    sets.push("current_step_index = ?");
    params.push(patch.currentStepIndex);
  }
  if (patch.pendingJobId !== undefined) {
    sets.push("pending_job_id = ?");
    params.push(patch.pendingJobId);
  }
  if (patch.stepOutputs !== undefined) {
    sets.push("step_outputs_json = ?");
    params.push(JSON.stringify(patch.stepOutputs));
  }
  if (patch.error !== undefined) {
    sets.push("error = ?");
    params.push(patch.error);
  }

  params.push(runId);
  db.prepare(`UPDATE skill_runs SET ${sets.join(", ")} WHERE id = ?`).run(
    ...params,
  );
}

export function linkSkillRunJob(
  skillRunId: string,
  jobId: string,
  stepId: string,
) {
  db.prepare(
    `INSERT OR IGNORE INTO skill_run_jobs (skill_run_id, job_id, step_id) VALUES (?, ?, ?)`,
  ).run(skillRunId, jobId, stepId);
}

export function serializeSkillRunForApi(row: SkillRunRow) {
  const skill = loadSkill(row.skill_id);
  const stepOutputs = parseStepOutputs(row);
  return {
    id: row.id,
    sessionId: row.session_id,
    skillId: row.skill_id,
    skillVersion: row.skill_version,
    skillName: skill.name,
    description: skill.description,
    status: row.status,
    prompt: row.prompt,
    steps: skill.steps.map((s, i) => ({
      id: s.id,
      label: s.label,
      type: s.type,
      index: i,
      done: i < row.current_step_index,
      current: i === row.current_step_index && row.status !== "completed",
      outputs: stepOutputs[s.id],
    })),
    currentStepIndex: row.current_step_index,
    pendingJobId: row.pending_job_id,
    estimatedPoints: row.estimated_points,
    confirmIfPointsOver: skill.confirmIfPointsOver,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
