import { createGenerationJob } from "../jobs.js";
import { buildJobObservation } from "../agent/job-observation.js";
import { AppError } from "../errors.js";
import { dramaImageGenerationJobParams } from "./image-job.js";
import { buildCharacterRefPrompt, CHARACTER_REF_ANGLES } from "./prompt-builders.js";
import {
  getDramaProject,
  parseProjectJson,
  updateDramaProject,
  type DramaProjectRow,
} from "./projects.js";
import type { CharacterCard, CharacterAngle, DramaProjectData } from "./schema.js";
import {
  countPendingTurnaroundJobs,
  deleteDramaTurnaroundJob,
  getDramaTurnaroundJobByJobId,
  linkDramaTurnaroundJob,
} from "./turnaround-jobs.js";

export function characterTurnaroundRefsComplete(char: CharacterCard): boolean {
  if (char.refUrl) return true;
  const ids = char.refOutputIds;
  return Boolean(ids?.front && ids?.three_quarter && ids?.side);
}

export function assertAllCharactersLockedForProduce(project: DramaProjectData) {
  for (const char of project.characters) {
    const locked = char.turnaroundStatus === "locked";
    if (!locked) {
      throw new AppError(
        400,
        "CHARACTERS_NOT_LOCKED",
        `角色「${char.name}」尚未定稿，请生成三视图并确认定稿后再制作`,
      );
    }
    if (!characterTurnaroundRefsComplete(char)) {
      throw new AppError(
        400,
        "CHARACTERS_MISSING_TURNAROUND",
        `角色「${char.name}」缺少三视图参考，请先生成或上传参考图`,
      );
    }
  }
}

function startTurnaroundAngleJob(
  row: DramaProjectRow,
  project: DramaProjectData,
  characterId: string,
  angle: CharacterAngle,
): string {
  const char = project.characters.find((c) => c.id === characterId);
  if (!char) throw new AppError(404, "NOT_FOUND", "角色不存在");

  const prompt = buildCharacterRefPrompt(char, angle, project.styleBible);
  const params = project.productionParams;
  const imageRouting = dramaImageGenerationJobParams(project);
  const { jobId } = createGenerationJob({
    sessionId: row.session_id,
    userId: row.user_id,
    prompt,
    modelId: imageRouting.modelId,
    routingMode: imageRouting.routingMode,
    autoRoute: imageRouting.autoRoute,
    mode: "chat",
    count: 1,
    resolution: params?.resolution ?? "1k",
    aspectRatio: params?.aspectRatio ?? project.styleBible.aspectRatio ?? "9:16",
    sourceLane: "agent",
  });

  linkDramaTurnaroundJob({
    jobId,
    projectId: row.id,
    userId: row.user_id,
    characterId,
    angle,
  });
  return jobId;
}

export function dispatchCharacterTurnaround(
  userId: string,
  projectId: string,
  characterId: string,
) {
  const row = getDramaProject(userId, projectId);
  if (!row) throw new AppError(404, "NOT_FOUND", "短剧项目不存在");

  const project = parseProjectJson(row);
  const char = project.characters.find((c) => c.id === characterId);
  if (!char) throw new AppError(404, "NOT_FOUND", "角色不存在");
  if (char.turnaroundStatus === "locked") {
    throw new AppError(400, "INVALID_STATE", "已定稿角色请先解锁后再重新生成");
  }

  char.turnaroundStatus = "draft";
  char.refOutputIds = {};
  char.refUrl = undefined;

  const jobIds = CHARACTER_REF_ANGLES.map((angle) =>
    startTurnaroundAngleJob(row, project, characterId, angle),
  );

  updateDramaProject(projectId, { project });

  return {
    status: "generating" as const,
    jobIds,
    characterId,
  };
}

export async function resumeCharacterTurnaroundOnJobCompleted(
  jobId: string,
): Promise<
  { userId: string; projectId: string; characterId: string } | undefined
> {
  const meta = getDramaTurnaroundJobByJobId(jobId);
  if (!meta) return;

  const row = getDramaProject(meta.user_id, meta.project_id);
  if (!row) {
    deleteDramaTurnaroundJob(jobId);
    return;
  }

  const observation = buildJobObservation(jobId);
  if (!observation) return;

  if (observation.status === "failed") {
    deleteDramaTurnaroundJob(jobId);
    return;
  }

  const outputId = observation.outputIds[0];
  if (!outputId) {
    deleteDramaTurnaroundJob(jobId);
    return;
  }

  const project = parseProjectJson(row);
  const char = project.characters.find((c) => c.id === meta.character_id);
  if (!char) {
    deleteDramaTurnaroundJob(jobId);
    return;
  }

  if (!char.refOutputIds) char.refOutputIds = {};
  char.refOutputIds[meta.angle as CharacterAngle] = outputId;
  deleteDramaTurnaroundJob(jobId);
  updateDramaProject(row.id, { project });
  return {
    userId: meta.user_id,
    projectId: row.id,
    characterId: meta.character_id,
  };
}

export function isCharacterTurnaroundBusy(
  projectId: string,
  characterId: string,
): boolean {
  return countPendingTurnaroundJobs(projectId, characterId) > 0;
}
