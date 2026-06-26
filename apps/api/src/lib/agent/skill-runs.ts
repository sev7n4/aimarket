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
    steps: skill.steps.map((s, i) => {
      const out = stepOutputs[s.id];
      return {
        id: s.id,
        label: s.label,
        type: s.type,
        index: i,
        done: i < row.current_step_index,
        current: i === row.current_step_index && row.status !== "completed",
        outputs: out
          ? {
              jobId: out.jobId,
              outputIds: out.outputIds,
              urls: out.urls,
              ...(out.heroOutputIndex !== undefined
                ? { heroOutputIndex: out.heroOutputIndex }
                : {}),
            }
          : undefined,
      };
    }),
    currentStepIndex: row.current_step_index,
    pendingJobId: row.pending_job_id,
    estimatedPoints: row.estimated_points,
    confirmIfPointsOver: skill.confirmIfPointsOver,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** D-S2（PROD-D02）：电商主图来源类型 */
export type CommerceHeroSource =
  | "ecommerce_set"
  | "commerce_promo_cutout"
  | "commerce_promo_upscale";

/** D-S2：电商主图候选项 */
export interface CommerceHeroCandidate {
  outputId: string;
  url: string;
  source: CommerceHeroSource;
  skillRunId: string;
  skillId: string;
  stepId: string;
  label: string;
}

const COMMERCE_SKILL_IDS = new Set([
  "commerce-promo-v1",
  "ecommerce-set-v1",
  "ecommerce-taobao-launch-v1",
]);

/**
 * D-S2：列出会话内可绑定的电商主图候选。
 * 从已完成的 commerce 类 skill_run 的 step_outputs 中提取：
 *   - gen_set 步骤的 heroOutputIndex 对应 outputId → source=ecommerce_set
 *   - cutout/cutout_hero 步骤的 outputIds[0] → source=commerce_promo_cutout
 *   - upscale/upscale_hero 步骤的 outputIds[0] → source=commerce_promo_upscale
 */
export function listSessionCommerceHeroes(
  sessionId: string,
  userId: string,
): CommerceHeroCandidate[] {
  const rows = db
    .prepare(
      `SELECT * FROM skill_runs WHERE session_id = ? AND user_id = ? AND status = 'completed' ORDER BY created_at DESC`,
    )
    .all(sessionId, userId) as unknown as SkillRunRow[];
  const heroes: CommerceHeroCandidate[] = [];
  for (const row of rows) {
    if (!COMMERCE_SKILL_IDS.has(row.skill_id)) continue;
    let skill: SkillDefinition;
    try {
      skill = loadSkill(row.skill_id);
    } catch {
      continue;
    }
    const stepOutputs = parseStepOutputs(row);
    for (const step of skill.steps) {
      const out = stepOutputs[step.id];
      if (!out?.outputIds?.length) continue;
      let outputId: string | undefined;
      let source: CommerceHeroSource | undefined;
      if (step.type === "generate_set") {
        const idx = out.heroOutputIndex ?? 0;
        outputId = out.outputIds[idx];
        source = "ecommerce_set";
      } else if (step.type === "tool" && step.toolId === "cutout") {
        outputId = out.outputIds[0];
        source = "commerce_promo_cutout";
      } else if (step.type === "tool" && step.toolId === "upscale") {
        outputId = out.outputIds[0];
        source = "commerce_promo_upscale";
      }
      if (outputId && source) {
        heroes.push({
          outputId,
          url: out.urls[0] ?? "",
          source,
          skillRunId: row.id,
          skillId: row.skill_id,
          stepId: step.id,
          label: step.label,
        });
      }
    }
  }
  return heroes;
}
