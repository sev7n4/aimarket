import {
  loadSkill,
  type SkillDefinition,
  type SkillStep,
} from "@aimarket/agent-skills";
import { ECOMMERCE_SLIDES } from "../ecommerce.js";
import { createGenerationJob } from "../jobs.js";
import { inferSkillStepSourceLane } from "../source-lane.js";
import { enrichPromptWithReferences } from "../references.js";
import { resolveReferenceUrls } from "../references.js";
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

const DEFAULT_SHOT_VIDEO_MODEL = "wan-2.6";

function buildEnrichedPrompt(row: SkillRunRow): string {
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
  return enrichedPrompt;
}

function resolveSourceOutputId(
  step: Extract<SkillStep, { type: "tool" | "video" }>,
  outputs: SkillStepOutputs,
): string {
  const sourceStep = step.sourceStep;
  if (!sourceStep) {
    throw new Error("缺少 sourceStep");
  }
  const src = outputs[sourceStep];
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

function startShotVideoBatchJob(
  row: SkillRunRow,
  step: Extract<SkillStep, { type: "shot_video_batch" }>,
  outputs: SkillStepOutputs,
  batchIndex: number,
  enrichedPrompt: string,
): string {
  const src = outputs[step.sourceStep];
  if (!src?.outputIds?.length) {
    throw new Error(`缺少上一步输出: ${step.sourceStep}`);
  }
  if (batchIndex >= src.outputIds.length) {
    throw new Error("shot_video_batch 批次已完成");
  }
  const sourceOutputId = src.outputIds[batchIndex]!;
  const refUrls = resolveReferenceUrls([sourceOutputId]);
  const { jobId } = createGenerationJob({
    sessionId: row.session_id,
    userId: row.user_id,
    prompt: `${enrichedPrompt}\n产品宣传镜头 ${batchIndex + 1}/${src.outputIds.length}`,
    modelId: DEFAULT_SHOT_VIDEO_MODEL,
    mode: "chat",
    count: 1,
    resolution: "1k",
    aspectRatio: "16:9",
    toolType: "video",
    sourceOutputId,
    referenceUrls: refUrls,
    sourceLane: "video",
  });
  linkSkillRunJob(row.id, jobId, step.id);
  return jobId;
}

function startConcatJob(
  row: SkillRunRow,
  skill: SkillDefinition,
  step: Extract<SkillStep, { type: "concat" }>,
  outputs: SkillStepOutputs,
): string {
  const sourceStepIds =
    step.sourceSteps ?? (step.sourceStep ? [step.sourceStep] : []);
  if (!sourceStepIds.length) {
    throw new Error("concat 缺少 sourceSteps");
  }

  let clipUrls: string[] = [];
  let bgmUrl: string | undefined;
  for (const srcId of sourceStepIds) {
    const srcOut = outputs[srcId];
    if (!srcOut?.urls?.length) {
      throw new Error(`缺少步骤输出: ${srcId}`);
    }
    const srcStepDef = skill.steps.find((s) => s.id === srcId);
    if (srcStepDef?.type === "music_gen") {
      bgmUrl = srcOut.urls[0];
    } else {
      clipUrls.push(...srcOut.urls.filter(Boolean));
    }
  }
  if (!clipUrls.length) {
    throw new Error("concat 缺少视频片段");
  }

  const subtitles = step.options?.subtitles
    ? clipUrls.map((_, i) => ({
        startSec: i * 5,
        endSec: (i + 1) * 5,
        text: `镜头 ${i + 1}`,
      }))
    : undefined;

  const { jobId } = createGenerationJob({
    sessionId: row.session_id,
    userId: row.user_id,
    prompt: row.prompt || "产品宣传成片",
    modelId: "agnes-image",
    mode: "chat",
    count: 1,
    resolution: "1k",
    aspectRatio: "16:9",
    toolType: "concat",
    sourceLane: "agent",
    toolContext: { clipUrls, subtitles, bgmUrl },
  });
  linkSkillRunJob(row.id, jobId, step.id);
  return jobId;
}

function startStepJob(
  row: SkillRunRow,
  skill: SkillDefinition,
  stepIndex: number,
  outputs: SkillStepOutputs,
): string {
  const step = skill.steps[stepIndex];
  const route = suggestModel("ecommerce", row.prompt);
  const enrichedPrompt = buildEnrichedPrompt(row);
  const sourceLane = inferSkillStepSourceLane(step);

  if (step.type === "generate_set") {
    const slideCount = step.count ?? ECOMMERCE_SLIDES.length;
    const labels =
      step.count != null
        ? Array.from({ length: slideCount }, (_, i) => `展示图 ${i + 1}`)
        : ECOMMERCE_SLIDES.map((s) => s.label);
    const { jobId } = createGenerationJob({
      sessionId: row.session_id,
      userId: row.user_id,
      prompt: enrichedPrompt,
      modelId: route.modelId,
      mode: "ecommerce",
      count: slideCount,
      resolution: "2k",
      aspectRatio: "1:1",
      slideLabels: labels,
      sourceLane,
    });
    linkSkillRunJob(row.id, jobId, step.id);
    return jobId;
  }

  if (step.type === "tool") {
    getTool(step.toolId);
    const sourceOutputId = step.sourceStep
      ? resolveSourceOutputId(step, outputs)
      : undefined;
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
      sourceLane,
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
      sourceLane,
    });
    linkSkillRunJob(row.id, jobId, step.id);
    return jobId;
  }

  if (step.type === "shot_video_batch") {
    const existing = outputs[step.id];
    const batchIndex = existing?.outputIds?.length ?? 0;
    return startShotVideoBatchJob(
      row,
      step,
      outputs,
      batchIndex,
      enrichedPrompt,
    );
  }

  if (step.type === "music_gen") {
    const { jobId } = createGenerationJob({
      sessionId: row.session_id,
      userId: row.user_id,
      prompt: enrichedPrompt || "生成背景音乐",
      modelId: route.modelId,
      mode: "chat",
      count: 1,
      resolution: "1k",
      aspectRatio: "16:9",
      toolType: "music-gen",
      sourceLane,
      toolContext: {
        toolId: "music-gen",
        style: enrichedPrompt || "轻快氛围配乐",
        bpm: step.options?.defaultBpm ?? 120,
        durationSec: step.options?.defaultDurationSec ?? 30,
      },
    });
    linkSkillRunJob(row.id, jobId, step.id);
    return jobId;
  }

  if (step.type === "concat") {
    return startConcatJob(row, skill, step, outputs);
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

  if (observation.status === "failed") {
    outputs[step.id] = stepOutput;
    updateSkillRun(row.id, {
      status: "failed",
      error: observation.error ?? "步骤失败",
      stepOutputs: outputs,
      pendingJobId: null,
    });
    return;
  }

  if (step.type === "shot_video_batch") {
    const batchStep = step;
    const prev = outputs[step.id];
    const merged: SkillStepOutput = {
      jobId,
      outputIds: [...(prev?.outputIds ?? []), ...observation.outputIds],
      urls: [...(prev?.urls ?? []), ...observation.urls],
    };
    outputs[step.id] = merged;

    const src = outputs[batchStep.sourceStep];
    const total = src?.outputIds?.length ?? 0;
    if (merged.outputIds.length < total) {
      const nextJobId = startShotVideoBatchJob(
        row,
        batchStep,
        outputs,
        merged.outputIds.length,
        buildEnrichedPrompt(row),
      );
      updateSkillRun(row.id, {
        stepOutputs: outputs,
        pendingJobId: nextJobId,
        status: "waiting_job",
      });
      return;
    }
  } else {
    outputs[step.id] = stepOutput;
  }

  if (
    step.type === "generate_set" &&
    observation.urls.length > 0
  ) {
    outputs[step.id]!.heroOutputIndex = await pickSkillHeroIndex({
      prompt: row.prompt,
      jobId,
      urls: observation.urls,
    });
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
