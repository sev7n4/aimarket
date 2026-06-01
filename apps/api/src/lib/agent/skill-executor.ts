import { loadSkill, type SkillDefinition, type SkillStep } from "@aimarket/agent-skills";
import { ECOMMERCE_SLIDES } from "../ecommerce.js";
import { createGenerationJob } from "../jobs.js";
import { enrichPromptWithReferences } from "../references.js";
import { suggestModel } from "../router.js";
import { db } from "../../db/index.js";
import { getTool } from "../tools.js";
import { buildJobObservation } from "./job-observation.js";
import { pickSkillHeroIndex } from "../../providers/vlm/pick-hero.js";
import {
  getSkillRun,
  getSkillRunByJobId,
  linkSkillRunJob,
  parseStepOutputs,
  updateSkillRun,
  type SkillRunRow,
  type SkillStepOutput,
  type SkillStepOutputs,
} from "./skill-runs.js";

function resolveSourceOutputId(
  step: Extract<SkillStep, { type: "tool" } | { type: "video" }>,
  outputs: SkillStepOutputs,
): string {
  const src = outputs[step.sourceStep];
  if (!src?.outputIds?.length) {
    throw new Error(`缺少上一步输出: ${step.sourceStep}`);
  }
  const yamlIdx =
    "sourceOutputIndex" in step ? (step.sourceOutputIndex ?? 0) : 0;
  const idx = src.heroOutputIndex ?? yamlIdx;
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

/** 启动当前步骤 Job（不阻塞等待完成）。 */
export async function startSkillRunStep(
  skillRunId: string,
  userId: string,
): Promise<SkillRunRow | undefined> {
  const row = getSkillRun(userId, skillRunId);
  if (!row) throw new Error("SKILL_RUN_NOT_FOUND");
  if (row.status === "waiting_confirm") {
    throw new Error("SKILL_RUN_NEEDS_CONFIRM");
  }
  if (row.status === "completed" || row.status === "cancelled") {
    return row;
  }
  if (row.status === "waiting_job" && row.pending_job_id) {
    return row;
  }

  const skill = loadSkill(row.skill_id);
  const stepIndex = row.current_step_index;
  if (stepIndex >= skill.steps.length) {
    updateSkillRun(skillRunId, {
      status: "completed",
      pendingJobId: null,
    });
    return getSkillRun(userId, skillRunId);
  }

  try {
    const outputs = parseStepOutputs(row);
    const jobId = startStepJob(row, skill, stepIndex, outputs);
    updateSkillRun(skillRunId, {
      status: "waiting_job",
      pendingJobId: jobId,
      error: null,
    });
    return getSkillRun(userId, skillRunId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "启动步骤失败";
    updateSkillRun(skillRunId, {
      status: "failed",
      error: message,
      pendingJobId: null,
    });
    return getSkillRun(userId, skillRunId);
  }
}

/** 兼容 Inngest / inline 调度入口：仅启动首步或续跑当前步。 */
export async function executeSkillRun(skillRunId: string, userId: string) {
  return startSkillRunStep(skillRunId, userId);
}

/** Job 完成后推进 Skill（由 `notifyAgentJobCompleted` 调用）。 */
export async function resumeSkillRunOnJobCompleted(jobId: string) {
  const row = getSkillRunByJobId(jobId);
  if (!row) return;
  if (row.pending_job_id !== jobId) return;
  if (row.status !== "waiting_job") return;

  const observation = buildJobObservation(jobId);
  if (!observation) return;

  const skill = loadSkill(row.skill_id);
  const step = skill.steps[row.current_step_index];
  if (!step) return;

  const outputs = parseStepOutputs(row);
  const stepOutput: SkillStepOutput = {
    jobId,
    outputIds: observation.outputIds,
    urls: observation.urls,
  };

  if (
    observation.status === "succeeded" &&
    step.type === "generate_set" &&
    observation.urls.length > 0
  ) {
    stepOutput.heroOutputIndex = await pickSkillHeroIndex({
      prompt: row.prompt,
      jobId,
      urls: observation.urls,
    });
  }

  outputs[step.id] = stepOutput;

  if (observation.status === "failed") {
    updateSkillRun(row.id, {
      status: "failed",
      error: observation.error ?? "步骤失败",
      stepOutputs: outputs,
      pendingJobId: null,
    });
    return;
  }

  const nextStepIndex = row.current_step_index + 1;
  const done = nextStepIndex >= skill.steps.length;

  updateSkillRun(row.id, {
    currentStepIndex: nextStepIndex,
    stepOutputs: outputs,
    pendingJobId: null,
    status: done ? "completed" : "running",
  });

  if (!done) {
    await startSkillRunStep(row.id, row.user_id);
  }
}
