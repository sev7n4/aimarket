import { loadSkill, type SkillDefinition, type SkillStep } from "@aimarket/agent-skills";
import { ECOMMERCE_SLIDES } from "../ecommerce.js";
import { createGenerationJob } from "../jobs.js";
import { enrichPromptWithReferences } from "../references.js";
import { suggestModel } from "../router.js";
import { db } from "../../db/index.js";
import { getTool } from "../tools.js";
import {
  getSkillRun,
  linkSkillRunJob,
  parseStepOutputs,
  updateSkillRun,
  type SkillRunRow,
  type SkillStepOutputs,
} from "./skill-runs.js";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForJob(jobId: string, maxMs = 600_000): Promise<{
  status: "succeeded" | "failed";
  outputIds: string[];
  urls: string[];
  error?: string;
}> {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const job = db
      .prepare(`SELECT status, error FROM generation_jobs WHERE id = ?`)
      .get(jobId) as { status: string; error: string | null } | undefined;
    if (!job) throw new Error("JOB_NOT_FOUND");
    if (job.status === "succeeded" || job.status === "failed") {
      const outputs = db
        .prepare(
          `SELECT id, url FROM job_outputs WHERE job_id = ? ORDER BY sort_order ASC`,
        )
        .all(jobId) as Array<{ id: string; url: string }>;
      return {
        status: job.status as "succeeded" | "failed",
        outputIds: outputs.map((o) => o.id),
        urls: outputs.map((o) => o.url),
        error: job.error ?? undefined,
      };
    }
    await sleep(1200);
  }
  throw new Error("JOB_TIMEOUT");
}

function resolveSourceOutputId(
  step: Extract<SkillStep, { type: "tool" } | { type: "video" }>,
  outputs: SkillStepOutputs,
): string {
  const src = outputs[step.sourceStep];
  if (!src?.outputIds?.length) {
    throw new Error(`缺少上一步输出: ${step.sourceStep}`);
  }
  const idx = "sourceOutputIndex" in step ? (step.sourceOutputIndex ?? 0) : 0;
  const outputId = src.outputIds[idx];
  if (!outputId) throw new Error(`步骤 ${step.sourceStep} 输出索引无效`);
  return outputId;
}

function startStepJob(
  row: SkillRunRow,
  skill: SkillDefinition,
  stepIndex: number,
  outputs: SkillStepOutputs,
): string {
  const step = skill.steps[stepIndex];
  const route = suggestModel("ecommerce", row.prompt);
  let enrichedPrompt = row.prompt;

  const inputs = row.inputs_json
    ? (JSON.parse(row.inputs_json) as {
        productAssetId?: string;
        referenceAssetId?: string;
      })
    : {};

  const assetUrls: string[] = [];
  for (const assetId of [inputs.productAssetId, inputs.referenceAssetId]) {
    if (!assetId) continue;
    const asset = db
      .prepare("SELECT url FROM assets WHERE id = ? AND user_id = ?")
      .get(assetId, row.user_id) as { url: string } | undefined;
    if (asset) assetUrls.push(asset.url);
  }
  if (assetUrls.length) {
    enrichedPrompt = enrichPromptWithReferences(enrichedPrompt, assetUrls);
  }

  if (step.type === "generate_set") {
    const { jobId } = createGenerationJob({
      sessionId: row.session_id,
      userId: row.user_id,
      prompt: enrichedPrompt,
      modelId: route.modelId,
      mode: "ecommerce",
      count: ECOMMERCE_SLIDES.length,
      resolution: "2k",
      aspectRatio: "1:1",
      slideLabels: ECOMMERCE_SLIDES.map((s) => s.label),
    });
    linkSkillRunJob(row.id, jobId, step.id);
    return jobId;
  }

  if (step.type === "tool") {
    getTool(step.toolId);
    const sourceOutputId = resolveSourceOutputId(step, outputs);
    const { jobId } = createGenerationJob({
      sessionId: row.session_id,
      userId: row.user_id,
      prompt: enrichedPrompt,
      modelId: route.modelId,
      mode: "ecommerce",
      count: 1,
      resolution: "2k",
      aspectRatio: "1:1",
      toolType: step.toolId,
      sourceOutputId,
    });
    linkSkillRunJob(row.id, jobId, step.id);
    return jobId;
  }

  if (step.type === "video") {
    const sourceOutputId = resolveSourceOutputId(step, outputs);
    const { jobId } = createGenerationJob({
      sessionId: row.session_id,
      userId: row.user_id,
      prompt: `${enrichedPrompt}\n【宣传片】15秒产品展示`,
      modelId: step.modelId,
      mode: "chat",
      count: 1,
      resolution: step.resolution,
      aspectRatio: step.aspectRatio,
      toolType: "video",
      sourceOutputId,
    });
    linkSkillRunJob(row.id, jobId, step.id);
    return jobId;
  }

  throw new Error(`UNSUPPORTED_STEP`);
}

/** 跑完整个 Skill（逐步创建 Job 并等待完成）。 */
export async function executeSkillRun(skillRunId: string, userId: string) {
  const initial = getSkillRun(userId, skillRunId);
  if (!initial) throw new Error("SKILL_RUN_NOT_FOUND");
  if (initial.status === "waiting_confirm") {
    throw new Error("SKILL_RUN_NEEDS_CONFIRM");
  }
  if (initial.status === "completed" || initial.status === "cancelled") {
    return initial;
  }

  const skill = loadSkill(initial.skill_id);
  updateSkillRun(skillRunId, { status: "running", error: null });

  let stepIndex = initial.current_step_index;
  let outputs = parseStepOutputs(initial);

  while (stepIndex < skill.steps.length) {
    const row = getSkillRun(userId, skillRunId)!;
    const step = skill.steps[stepIndex];
    const jobId = startStepJob(row, skill, stepIndex, outputs);

    updateSkillRun(skillRunId, {
      status: "waiting_job",
      pendingJobId: jobId,
    });

    const result = await waitForJob(jobId);
    outputs = { ...outputs, [step.id]: { jobId, ...result } };

    if (result.status === "failed") {
      updateSkillRun(skillRunId, {
        status: "failed",
        error: result.error ?? "步骤失败",
        stepOutputs: outputs,
        pendingJobId: null,
      });
      return getSkillRun(userId, skillRunId);
    }

    stepIndex += 1;
    updateSkillRun(skillRunId, {
      currentStepIndex: stepIndex,
      stepOutputs: outputs,
      pendingJobId: null,
      status: stepIndex >= skill.steps.length ? "completed" : "running",
    });
  }

  return getSkillRun(userId, skillRunId);
}
