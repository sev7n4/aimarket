import { createGenerationJob } from "../jobs.js";
import { resolveReferenceUrls } from "../references.js";
import { runVlmCharacterAudit } from "../../providers/vlm/character-audit.js";
import {
  buildCharacterRefPrompt,
  buildKeyframePrompt,
  buildSceneRefPrompt,
  buildShotVideoPrompt,
  CHARACTER_REF_ANGLES,
} from "./prompt-builders.js";
import {
  parseProjectJson,
  updateDramaProject,
} from "./projects.js";
import {
  defaultProgress,
  getDramaRun,
  getDramaRunByJobId,
  getDramaRunJobMeta,
  linkDramaRunJob,
  parseProgress,
  updateDramaRun,
  type DramaRunRow,
} from "./runs.js";
import {
  DRAMA_PIPELINE_STEPS,
  type CharacterAngle,
  type DramaPipelineStep,
  type DramaProgress,
  type DramaProjectData,
  type StoryboardShot,
} from "./schema.js";
import { buildJobObservation } from "../agent/job-observation.js";
import { db } from "../../db/index.js";

const MAX_KEYFRAME_RETRIES = 2;
const MAX_KEYFRAME_PARALLEL = Number(process.env.DRAMA_KEYFRAME_PARALLEL ?? 3);
const MAX_SHOT_VIDEO_PARALLEL = Number(process.env.DRAMA_SHOT_VIDEO_PARALLEL ?? 2);

function getProjectForRun(row: DramaRunRow): DramaProjectData {
  const projectRow = db
    .prepare(`SELECT * FROM drama_projects WHERE id = ?`)
    .get(row.project_id) as { project_json: string } | undefined;
  if (!projectRow) throw new Error("DRAMA_PROJECT_NOT_FOUND");
  return parseProjectJson({
    id: row.project_id,
    session_id: row.session_id,
    user_id: row.user_id,
    user_idea: "",
    project_json: projectRow.project_json,
    status: "producing",
    created_at: "",
    updated_at: "",
  });
}

function saveProject(row: DramaRunRow, project: DramaProjectData) {
  updateDramaProject(row.project_id, { project, status: "producing" });
}

function collectCharacterRefUrls(
  project: DramaProjectData,
  characterId: string,
): string[] {
  const char = project.characters.find((c) => c.id === characterId);
  if (!char?.refOutputIds) return [];
  const ids = Object.values(char.refOutputIds).filter(Boolean) as string[];
  return resolveReferenceUrls(ids);
}

function getReadyKeyframeShots(
  project: DramaProjectData,
  inFlight: Set<string>,
): StoryboardShot[] {
  const hasKeyframe = new Set(
    project.shots.filter((s) => s.keyframeOutputId).map((s) => s.id),
  );
  return project.shots
    .filter((shot) => {
      if (hasKeyframe.has(shot.id) || inFlight.has(shot.id)) return false;
      if (shot.useLastFrameContinuity && shot.order > 0) {
        const prev = project.shots.find((s) => s.order === shot.order - 1);
        if (!prev?.keyframeOutputId) return false;
      }
      return true;
    })
    .sort((a, b) => a.order - b.order);
}

function countKeyframesDone(project: DramaProjectData): number {
  return project.shots.filter((s) => s.keyframeOutputId).length;
}

function countVideosDone(project: DramaProjectData): number {
  return project.shots.filter((s) => s.videoOutputId).length;
}

function getReadyShotVideoShots(
  project: DramaProjectData,
  inFlight: Set<string>,
): StoryboardShot[] {
  const hasVideo = new Set(
    project.shots.filter((s) => s.videoOutputId).map((s) => s.id),
  );
  return project.shots
    .filter((shot) => {
      if (!shot.keyframeOutputId || hasVideo.has(shot.id) || inFlight.has(shot.id)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.order - b.order);
}

function collectShotRefOutputIds(
  project: DramaProjectData,
  shot: StoryboardShot,
): string[] {
  const ids: string[] = [];
  for (const cid of shot.characterIds) {
    const char = project.characters.find((c) => c.id === cid);
    if (char?.refOutputIds?.front) ids.push(char.refOutputIds.front);
    if (char?.refOutputIds?.three_quarter)
      ids.push(char.refOutputIds.three_quarter);
  }
  const scene = project.scenes.find((s) => s.id === shot.sceneId);
  if (scene?.refOutputId) ids.push(scene.refOutputId);
  if (shot.useLastFrameContinuity && shot.order > 0) {
    const prev = project.shots.find((s) => s.order === shot.order - 1);
    if (prev?.keyframeOutputId) ids.push(prev.keyframeOutputId);
  }
  return ids;
}

function pipelineStepIndex(step: DramaPipelineStep): number {
  return DRAMA_PIPELINE_STEPS.indexOf(step);
}

function advancePipeline(
  progress: DramaProgress,
  project?: DramaProjectData,
): DramaProgress | null {
  const idx = pipelineStepIndex(progress.currentPipelineStep);
  if (idx < 0 || idx >= DRAMA_PIPELINE_STEPS.length - 1) return null;
  let nextIdx = idx + 1;
  if (
    project?.productionParams?.previewTier === "low" &&
    DRAMA_PIPELINE_STEPS[nextIdx] === "lipsync"
  ) {
    nextIdx += 1;
  }
  const next = DRAMA_PIPELINE_STEPS[nextIdx]!;
  return {
    ...defaultProgress(),
    currentPipelineStep: next,
    keyframeRetries: progress.keyframeRetries,
    narratorAudioOutputId: progress.narratorAudioOutputId,
    finalVideoUrl: progress.finalVideoUrl,
  };
}

function startCharRefJob(
  row: DramaRunRow,
  project: DramaProjectData,
  progress: DramaProgress,
): string {
  const char = project.characters[progress.charRefIndex];
  if (!char) throw new Error("角色索引越界");
  const angle = CHARACTER_REF_ANGLES[progress.charRefAngleIndex] ?? "front";
  const prompt = buildCharacterRefPrompt(char, angle as CharacterAngle, project.styleBible);
  const params = project.productionParams;
  const { jobId } = createGenerationJob({
    sessionId: row.session_id,
    userId: row.user_id,
    prompt,
    modelId: params?.imageModelId ?? "agnes-image",
    mode: "chat",
    count: 1,
    resolution: params?.resolution ?? "1k",
    aspectRatio: params?.aspectRatio ?? "9:16",
    sourceLane: "agent",
  });
  linkDramaRunJob(row.id, jobId, "char_refs", char.id);
  return jobId;
}

function startSceneRefJob(
  row: DramaRunRow,
  project: DramaProjectData,
  progress: DramaProgress,
): string {
  const scene = project.scenes[progress.sceneRefIndex];
  if (!scene) throw new Error("场景索引越界");
  const prompt = buildSceneRefPrompt(scene, project.styleBible);
  const params = project.productionParams;
  const { jobId } = createGenerationJob({
    sessionId: row.session_id,
    userId: row.user_id,
    prompt,
    modelId: params?.imageModelId ?? "agnes-image",
    mode: "chat",
    count: 1,
    resolution: params?.resolution ?? "1k",
    aspectRatio: params?.aspectRatio ?? "16:9",
    sourceLane: "agent",
  });
  linkDramaRunJob(row.id, jobId, "scene_refs", scene.id);
  return jobId;
}

function startKeyframeJobForShot(
  row: DramaRunRow,
  project: DramaProjectData,
  shot: StoryboardShot,
): string {
  const scene = project.scenes.find((s) => s.id === shot.sceneId);
  const prompt = buildKeyframePrompt(
    shot,
    project.characters,
    scene,
    project.styleBible,
  );
  const refIds = collectShotRefOutputIds(project, shot);
  const refUrls = refIds.length ? resolveReferenceUrls(refIds) : undefined;
  const params = project.productionParams;
  const { jobId } = createGenerationJob({
    sessionId: row.session_id,
    userId: row.user_id,
    prompt,
    modelId: params?.imageModelId ?? "agnes-image",
    mode: "chat",
    count: 1,
    resolution: params?.resolution ?? "1k",
    aspectRatio: params?.aspectRatio ?? "9:16",
    referenceUrls: refUrls,
    sourceLane: "agent",
    toolContext: refUrls?.length ? { dramaShotId: shot.id } : undefined,
  });
  linkDramaRunJob(row.id, jobId, "keyframes", shot.id);
  return jobId;
}

function startKeyframeBatch(
  row: DramaRunRow,
  project: DramaProjectData,
  progress: DramaProgress,
): { progress: DramaProgress; jobIds: string[] } {
  const inFlight = new Set((progress.pendingBatch ?? []).map((p) => p.shotId));
  const ready = getReadyKeyframeShots(project, inFlight);
  const batch = ready.slice(0, MAX_KEYFRAME_PARALLEL);
  if (!batch.length) {
    return { progress, jobIds: [] };
  }
  const pendingBatch = batch.map((shot) => ({
    shotId: shot.id,
    jobId: startKeyframeJobForShot(row, project, shot),
  }));
  progress = {
    ...progress,
    pendingBatch,
    shotIndex: countKeyframesDone(project),
  };
  return { progress, jobIds: pendingBatch.map((p) => p.jobId) };
}

function startKeyframeJob(
  row: DramaRunRow,
  project: DramaProjectData,
  progress: DramaProgress,
): string {
  const { progress: next, jobIds } = startKeyframeBatch(row, project, progress);
  Object.assign(progress, next);
  const first = jobIds[0];
  if (!first) throw new Error("无待生成关键帧镜头");
  return first;
}

function startShotVideoJobForShot(
  row: DramaRunRow,
  project: DramaProjectData,
  shot: StoryboardShot,
): string {
  const prompt = buildShotVideoPrompt(shot, project.characters, project.styleBible);
  const refUrls = resolveReferenceUrls([shot.keyframeOutputId!]);
  const params = project.productionParams;
  const { jobId } = createGenerationJob({
    sessionId: row.session_id,
    userId: row.user_id,
    prompt,
    modelId: params?.videoModelId ?? "wan-2.6",
    mode: "chat",
    count: 1,
    resolution: params?.resolution ?? "1k",
    aspectRatio: params?.aspectRatio ?? "9:16",
    toolType: "video",
    referenceUrls: refUrls,
    sourceLane: "video",
    toolContext: {
      videoReferenceMode: "first-last",
      durationSec: shot.durationSec,
      referenceUrls: refUrls,
      dramaShotId: shot.id,
    },
  });
  linkDramaRunJob(row.id, jobId, "shot_videos", shot.id);
  return jobId;
}

function startShotVideoBatch(
  row: DramaRunRow,
  project: DramaProjectData,
  progress: DramaProgress,
): { progress: DramaProgress; jobIds: string[] } {
  const inFlight = new Set((progress.pendingBatch ?? []).map((p) => p.shotId));
  const ready = getReadyShotVideoShots(project, inFlight);
  const batch = ready.slice(0, MAX_SHOT_VIDEO_PARALLEL);
  if (!batch.length) {
    return { progress, jobIds: [] };
  }
  const pendingBatch = batch.map((shot) => ({
    shotId: shot.id,
    jobId: startShotVideoJobForShot(row, project, shot),
  }));
  progress = {
    ...progress,
    pendingBatch,
    shotIndex: countVideosDone(project),
  };
  return { progress, jobIds: pendingBatch.map((p) => p.jobId) };
}

function startShotVideoJob(
  row: DramaRunRow,
  project: DramaProjectData,
  progress: DramaProgress,
): string {
  const { progress: next, jobIds } = startShotVideoBatch(row, project, progress);
  Object.assign(progress, next);
  const first = jobIds[0];
  if (!first) throw new Error("无待生成视频镜头");
  return first;
}

function startNarratorTtsJob(
  row: DramaRunRow,
  project: DramaProjectData,
): string {
  const text = project.script.narratorLines.join("。");
  const { jobId } = createGenerationJob({
    sessionId: row.session_id,
    userId: row.user_id,
    prompt: text,
    modelId: "agnes-image",
    mode: "chat",
    count: 1,
    resolution: "1k",
    aspectRatio: "1:1",
    toolType: "tts",
    sourceLane: "agent",
    toolContext: { voiceStyle: "沉稳旁白", dramaNarrator: true },
  });
  linkDramaRunJob(row.id, jobId, "narrator_tts");
  return jobId;
}

function startTtsJob(
  row: DramaRunRow,
  project: DramaProjectData,
  progress: DramaProgress,
): string {
  const shotsWithDialogue = project.shots.filter((s) => s.dialogue.length > 0);
  const shot = shotsWithDialogue[progress.ttsIndex];
  if (!shot) throw new Error("TTS 索引越界");
  const line = shot.dialogue[0]!;
  const char = project.characters.find((c) => c.id === line.characterId);
  const { jobId } = createGenerationJob({
    sessionId: row.session_id,
    userId: row.user_id,
    prompt: line.line,
    modelId: "agnes-image",
    mode: "chat",
    count: 1,
    resolution: "1k",
    aspectRatio: "1:1",
    toolType: "tts",
    sourceLane: "agent",
    toolContext: {
      voiceStyle: char?.voiceStyle,
      characterId: line.characterId,
      dramaShotId: shot.id,
    },
  });
  linkDramaRunJob(row.id, jobId, "tts", shot.id);
  return jobId;
}

function startLipsyncJob(
  row: DramaRunRow,
  project: DramaProjectData,
  progress: DramaProgress,
): string {
  const shotsWithDialogue = project.shots.filter(
    (s) => s.dialogue.length > 0 && s.videoOutputId && s.audioOutputId,
  );
  const shot = shotsWithDialogue[progress.lipsyncIndex];
  if (!shot) throw new Error("口型同步索引越界");
  const videoUrls = resolveReferenceUrls([shot.videoOutputId!]);
  const audioUrls = resolveReferenceUrls([shot.audioOutputId!]);
  const { jobId } = createGenerationJob({
    sessionId: row.session_id,
    userId: row.user_id,
    prompt: `口型同步：${shot.dialogue[0]?.line ?? ""}`,
    modelId: "agnes-image",
    mode: "chat",
    count: 1,
    resolution: "1k",
    aspectRatio: "1:1",
    toolType: "lipsync",
    sourceLane: "agent",
    toolContext: {
      videoUrl: videoUrls[0],
      audioUrl: audioUrls[0],
      dramaShotId: shot.id,
    },
  });
  linkDramaRunJob(row.id, jobId, "lipsync", shot.id);
  return jobId;
}

function startConcatJob(
  row: DramaRunRow,
  project: DramaProjectData,
  progress: DramaProgress,
): string {
  const clipIds = project.shots
    .map((s) => s.lipsyncOutputId ?? s.videoOutputId)
    .filter(Boolean) as string[];
  const clipUrls = resolveReferenceUrls(clipIds);
  const subtitles = project.shots.flatMap((shot, i) => {
    const line = shot.dialogue[0]?.line;
    if (!line) return [];
    const start = project.shots
      .slice(0, i)
      .reduce((sum, s) => sum + s.durationSec, 0);
    return [{ startSec: start, endSec: start + shot.durationSec, text: line }];
  });
  const narratorAudioUrl = progress.narratorAudioOutputId
    ? resolveReferenceUrls([progress.narratorAudioOutputId])[0]
    : undefined;
  const bgmUrl =
    project.productionParams?.bgmUrl ?? process.env.DRAMA_BGM_URL;
  const { jobId } = createGenerationJob({
    sessionId: row.session_id,
    userId: row.user_id,
    prompt: project.script.title,
    modelId: "agnes-image",
    mode: "chat",
    count: 1,
    resolution: "1k",
    aspectRatio: project.styleBible.aspectRatio,
    toolType: "concat",
    sourceLane: "agent",
    toolContext: { clipUrls, subtitles, bgmUrl, narratorAudioUrl },
  });
  linkDramaRunJob(row.id, jobId, "concat");
  return jobId;
}

function startJobForStep(
  row: DramaRunRow,
  project: DramaProjectData,
  progress: DramaProgress,
): string {
  switch (progress.currentPipelineStep) {
    case "char_refs":
      return startCharRefJob(row, project, progress);
    case "scene_refs":
      return startSceneRefJob(row, project, progress);
    case "keyframes":
      return startKeyframeJob(row, project, progress);
    case "shot_videos":
      return startShotVideoJob(row, project, progress);
    case "tts":
      return startTtsJob(row, project, progress);
    case "lipsync":
      return startLipsyncJob(row, project, progress);
    case "narrator_tts":
      return startNarratorTtsJob(row, project);
    case "concat":
      return startConcatJob(row, project, progress);
    default:
      throw new Error(`未知流水线步骤: ${progress.currentPipelineStep}`);
  }
}

function isStepComplete(
  project: DramaProjectData,
  progress: DramaProgress,
): boolean {
  switch (progress.currentPipelineStep) {
    case "char_refs":
      return progress.charRefIndex >= project.characters.length;
    case "scene_refs":
      return progress.sceneRefIndex >= project.scenes.length;
    case "keyframes":
      return project.shots.every((s) => Boolean(s.keyframeOutputId));
    case "shot_videos":
      return project.shots.every((s) => Boolean(s.videoOutputId));
    case "tts":
      return (
        progress.ttsIndex >=
        project.shots.filter((s) => s.dialogue.length > 0).length
      );
    case "lipsync":
      if (project.productionParams?.previewTier === "low") return true;
      return (
        progress.lipsyncIndex >=
        project.shots.filter((s) => s.dialogue.length > 0).length
      );
    case "narrator_tts":
      return (
        project.script.narratorLines.length === 0 ||
        Boolean(progress.narratorAudioOutputId)
      );
    case "concat":
      return Boolean(progress.finalVideoUrl);
    default:
      return true;
  }
}

/** 启动或续跑短剧流水线 */
export async function startDramaRunStep(
  dramaRunId: string,
  userId: string,
): Promise<DramaRunRow | undefined> {
  const row = getDramaRun(userId, dramaRunId);
  if (!row) throw new Error("DRAMA_RUN_NOT_FOUND");
  if (row.status === "waiting_confirm") throw new Error("DRAMA_RUN_NEEDS_CONFIRM");
  if (["completed", "cancelled", "failed"].includes(row.status)) return row;
  if (row.status === "waiting_job") {
    const existing = parseProgress(row);
    if (
      (existing.currentPipelineStep === "keyframes" ||
        existing.currentPipelineStep === "shot_videos") &&
      (existing.pendingBatch?.length ?? 0) > 0
    ) {
      return row;
    }
    if (row.pending_job_id) return row;
  }

  const project = getProjectForRun(row);
  let progress = parseProgress(row);

  if (isStepComplete(project, progress)) {
    const next = advancePipeline(progress, project);
    if (!next) {
      updateDramaRun(dramaRunId, {
        status: "completed",
        pendingJobId: null,
        currentStepIndex: DRAMA_PIPELINE_STEPS.length,
      });
      updateDramaProject(row.project_id, { status: "completed" });
      return getDramaRun(userId, dramaRunId);
    }
    progress = next;
    updateDramaRun(dramaRunId, {
      progress,
      currentStepIndex: pipelineStepIndex(progress.currentPipelineStep),
      status: "running",
    });
  }

  try {
    const jobId = startJobForStep(row, project, progress);
    updateDramaRun(dramaRunId, {
      status: "waiting_job",
      pendingJobId: jobId,
      progress,
      error: null,
    });
    return getDramaRun(userId, dramaRunId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "启动步骤失败";
    updateDramaRun(dramaRunId, {
      status: "failed",
      error: message,
      pendingJobId: null,
    });
    updateDramaProject(row.project_id, { status: "failed" });
    return getDramaRun(userId, dramaRunId);
  }
}

export function dispatchDramaRun(dramaRunId: string, userId: string) {
  void startDramaRunStep(dramaRunId, userId).catch((err) => {
    console.error("[drama] execute failed:", err);
  });
}

async function handleCharRefComplete(
  row: DramaRunRow,
  project: DramaProjectData,
  progress: DramaProgress,
  outputId: string,
) {
  const char = project.characters[progress.charRefIndex]!;
  const angle = (CHARACTER_REF_ANGLES[progress.charRefAngleIndex] ??
    "front") as CharacterAngle;
  if (!char.refOutputIds) char.refOutputIds = {};
  char.refOutputIds[angle] = outputId;

  let nextAngle = progress.charRefAngleIndex + 1;
  let nextChar = progress.charRefIndex;
  if (nextAngle >= CHARACTER_REF_ANGLES.length) {
    nextAngle = 0;
    nextChar += 1;
  }
  progress.charRefAngleIndex = nextAngle;
  progress.charRefIndex = nextChar;
  saveProject(row, project);
  return progress;
}

async function handleKeyframeComplete(
  row: DramaRunRow,
  project: DramaProjectData,
  progress: DramaProgress,
  shot: StoryboardShot,
  outputId: string,
  outputUrl: string,
): Promise<{ progress: DramaProgress; retryShotId?: string }> {
  const refUrls = collectShotRefOutputIds(project, shot).flatMap((id) =>
    resolveReferenceUrls([id]),
  );

  const audit = await runVlmCharacterAudit({
    referenceUrls: refUrls,
    generatedUrl: outputUrl,
    styleBiblePrompt: project.styleBible.globalContextBlock ?? "",
  });

  const retries = progress.keyframeRetries[shot.id] ?? 0;
  if (!audit.pass && retries < MAX_KEYFRAME_RETRIES) {
    progress.keyframeRetries[shot.id] = retries + 1;
    saveProject(row, project);
    return { progress, retryShotId: shot.id };
  }

  shot.keyframeOutputId = outputId;
  shot.auditScore = {
    character: audit.characterScore,
    style: audit.styleScore,
  };
  shot.status = "keyframe";
  progress.shotIndex = countKeyframesDone(project);
  saveProject(row, project);
  return { progress };
}

export async function resumeDramaRunOnJobCompleted(jobId: string) {
  const row = getDramaRunByJobId(jobId);
  if (!row) return;
  if (row.status !== "waiting_job") return;

  const progress = parseProgress(row);
  const inBatch = progress.pendingBatch?.some((p) => p.jobId === jobId);
  if (!inBatch && row.pending_job_id !== jobId) return;

  const observation = buildJobObservation(jobId);
  if (!observation) return;

  let project = getProjectForRun(row);
  let nextProgress = progress;
  const step = progress.currentPipelineStep;

  if (observation.status === "failed") {
    updateDramaRun(row.id, {
      status: "failed",
      error: observation.error ?? "步骤失败",
      pendingJobId: null,
    });
    updateDramaProject(row.project_id, { status: "failed" });
    return;
  }

  const outputId = observation.outputIds[0];
  const outputUrl = observation.urls[0];
  if (!outputId) {
    updateDramaRun(row.id, {
      status: "failed",
      error: "步骤无输出",
      pendingJobId: null,
    });
    return;
  }

  if (step === "char_refs") {
    nextProgress = await handleCharRefComplete(row, project, nextProgress, outputId);
  } else if (step === "scene_refs") {
    const scene = project.scenes[nextProgress.sceneRefIndex]!;
    scene.refOutputId = outputId;
    nextProgress.sceneRefIndex += 1;
    saveProject(row, project);
  } else if (step === "keyframes") {
    if (!outputUrl) {
      updateDramaRun(row.id, {
        status: "failed",
        error: "关键帧无 URL",
        pendingJobId: null,
      });
      return;
    }
    const meta = getDramaRunJobMeta(jobId);
    const shot =
      project.shots.find((s) => s.id === meta?.shot_id) ??
      project.shots[nextProgress.shotIndex];
    if (!shot) {
      updateDramaRun(row.id, {
        status: "failed",
        error: "关键帧镜头未找到",
        pendingJobId: null,
      });
      return;
    }
    const result = await handleKeyframeComplete(
      row,
      project,
      nextProgress,
      shot,
      outputId,
      outputUrl,
    );
    nextProgress = result.progress;
    project = getProjectForRun(row);

    if (result.retryShotId) {
      const retryJobId = startKeyframeJobForShot(row, project, shot);
      nextProgress.pendingBatch = [{ shotId: shot.id, jobId: retryJobId }];
      updateDramaRun(row.id, {
        progress: nextProgress,
        pendingJobId: retryJobId,
        status: "waiting_job",
      });
      return;
    }

    nextProgress.pendingBatch = (nextProgress.pendingBatch ?? []).filter(
      (p) => p.jobId !== jobId,
    );
    if ((nextProgress.pendingBatch?.length ?? 0) > 0) {
      updateDramaRun(row.id, {
        progress: nextProgress,
        pendingJobId: nextProgress.pendingBatch![0]!.jobId,
        status: "waiting_job",
      });
      return;
    }

    updateDramaRun(row.id, {
      progress: nextProgress,
      pendingJobId: null,
      status: "running",
      currentStepIndex: pipelineStepIndex(nextProgress.currentPipelineStep),
    });
    await startDramaRunStep(row.id, row.user_id);
    return;
  } else if (step === "shot_videos") {
    const meta = getDramaRunJobMeta(jobId);
    const shot =
      project.shots.find((s) => s.id === meta?.shot_id) ??
      project.shots[nextProgress.shotIndex];
    if (!shot) {
      updateDramaRun(row.id, {
        status: "failed",
        error: "视频镜头未找到",
        pendingJobId: null,
      });
      return;
    }
    shot.videoOutputId = outputId;
    shot.status = "video";
    nextProgress.shotIndex = countVideosDone(project);
    saveProject(row, project);

    nextProgress.pendingBatch = (nextProgress.pendingBatch ?? []).filter(
      (p) => p.jobId !== jobId,
    );
    if ((nextProgress.pendingBatch?.length ?? 0) > 0) {
      updateDramaRun(row.id, {
        progress: nextProgress,
        pendingJobId: nextProgress.pendingBatch![0]!.jobId,
        status: "waiting_job",
      });
      return;
    }

    updateDramaRun(row.id, {
      progress: nextProgress,
      pendingJobId: null,
      status: "running",
      currentStepIndex: pipelineStepIndex(nextProgress.currentPipelineStep),
    });
    await startDramaRunStep(row.id, row.user_id);
    return;
  } else if (step === "tts") {
    const shotsWithDialogue = project.shots.filter((s) => s.dialogue.length > 0);
    const shot = shotsWithDialogue[nextProgress.ttsIndex]!;
    shot.audioOutputId = outputId;
    nextProgress.ttsIndex += 1;
    saveProject(row, project);
  } else if (step === "lipsync") {
    const shotsWithDialogue = project.shots.filter((s) => s.dialogue.length > 0);
    const shot = shotsWithDialogue[nextProgress.lipsyncIndex]!;
    shot.lipsyncOutputId = outputId;
    shot.status = "done";
    nextProgress.lipsyncIndex += 1;
    saveProject(row, project);
  } else if (step === "narrator_tts") {
    nextProgress.narratorAudioOutputId = outputId;
  } else if (step === "concat") {
    nextProgress.finalVideoUrl = outputUrl ?? outputId;
    updateDramaRun(row.id, {
      finalVideoUrl: nextProgress.finalVideoUrl,
      progress: nextProgress,
      pendingJobId: null,
      status: "completed",
      currentStepIndex: DRAMA_PIPELINE_STEPS.length,
    });
    updateDramaProject(row.project_id, { status: "completed" });
    return;
  }

  updateDramaRun(row.id, {
    progress: nextProgress,
    pendingJobId: null,
    status: "running",
    currentStepIndex: pipelineStepIndex(nextProgress.currentPipelineStep),
  });

  await startDramaRunStep(row.id, row.user_id);
}

/** 单镜重试（RHTV 局部修改不重跑全片） */
export async function retryDramaShot(
  userId: string,
  runId: string,
  shotId: string,
  stage: "keyframe" | "video",
): Promise<DramaRunRow | undefined> {
  const row = getDramaRun(userId, runId);
  if (!row) throw new Error("DRAMA_RUN_NOT_FOUND");
  const project = getProjectForRun(row);
  const shot = project.shots.find((s) => s.id === shotId);
  if (!shot) throw new Error("SHOT_NOT_FOUND");

  const progress = parseProgress(row);
  if (stage === "keyframe") {
    progress.currentPipelineStep = "keyframes";
    progress.shotIndex = shot.order;
    progress.keyframeRetries[shotId] = 0;
    progress.pendingBatch = [];
    shot.keyframeOutputId = undefined;
    shot.status = "pending";
  } else {
    progress.currentPipelineStep = "shot_videos";
    progress.shotIndex = shot.order;
    progress.pendingBatch = [];
    shot.videoOutputId = undefined;
    shot.status = "keyframe";
  }
  saveProject(row, project);
  updateDramaRun(runId, {
    progress,
    status: "queued",
    pendingJobId: null,
    error: null,
  });
  return startDramaRunStep(runId, userId);
}
