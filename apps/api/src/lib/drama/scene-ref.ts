import { createGenerationJob } from "../jobs.js";
import { buildJobObservation } from "../agent/job-observation.js";
import { AppError } from "../errors.js";
import { dramaImageGenerationJobParams } from "./image-job.js";
import { buildSceneRefPrompt } from "./prompt-builders.js";
import {
  getDramaProject,
  parseProjectJson,
  updateDramaProject,
  type DramaProjectRow,
} from "./projects.js";
import type { DramaProjectData, SceneCard } from "./schema.js";
import {
  countPendingSceneRefJobs,
  deleteDramaSceneRefJob,
  getDramaSceneRefJobByJobId,
  linkDramaSceneRefJob,
} from "./scene-ref-jobs.js";

export function sceneRefComplete(scene: SceneCard): boolean {
  return Boolean(scene.refUrl || scene.refOutputId);
}

export function dispatchSceneRef(
  userId: string,
  projectId: string,
  sceneId: string,
) {
  const row = getDramaProject(userId, projectId);
  if (!row) throw new AppError(404, "NOT_FOUND", "短剧项目不存在");

  const project = parseProjectJson(row);
  const scene = project.scenes.find((s) => s.id === sceneId);
  if (!scene) throw new AppError(404, "NOT_FOUND", "场景不存在");
  if (sceneRefComplete(scene)) {
    return { status: "ready" as const, sceneId, jobId: null };
  }
  if (countPendingSceneRefJobs(projectId, sceneId) > 0) {
    return { status: "generating" as const, sceneId, jobId: null };
  }

  const jobId = startSceneRefJob(row, project, sceneId);
  updateDramaProject(projectId, { project });
  return { status: "generating" as const, sceneId, jobId };
}

function startSceneRefJob(
  row: DramaProjectRow,
  project: DramaProjectData,
  sceneId: string,
): string {
  const scene = project.scenes.find((s) => s.id === sceneId);
  if (!scene) throw new AppError(404, "NOT_FOUND", "场景不存在");

  const prompt = buildSceneRefPrompt(scene, project.styleBible);
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
    aspectRatio: params?.aspectRatio ?? project.styleBible.aspectRatio ?? "16:9",
    sourceLane: "agent",
  });

  linkDramaSceneRefJob({
    jobId,
    projectId: row.id,
    userId: row.user_id,
    sceneId,
  });
  return jobId;
}

export async function resumeSceneRefOnJobCompleted(
  jobId: string,
): Promise<{ userId: string; projectId: string; sceneId: string } | undefined> {
  const meta = getDramaSceneRefJobByJobId(jobId);
  if (!meta) return;

  const row = getDramaProject(meta.user_id, meta.project_id);
  if (!row) {
    deleteDramaSceneRefJob(jobId);
    return;
  }

  const observation = buildJobObservation(jobId);
  deleteDramaSceneRefJob(jobId);
  if (!observation || observation.status === "failed") {
    return { userId: meta.user_id, projectId: row.id, sceneId: meta.scene_id };
  }

  const outputId = observation.outputIds[0];
  if (!outputId) {
    return { userId: meta.user_id, projectId: row.id, sceneId: meta.scene_id };
  }

  const project = parseProjectJson(row);
  const scene = project.scenes.find((s) => s.id === meta.scene_id);
  if (!scene) return;

  scene.refOutputId = outputId;
  updateDramaProject(row.id, { project });
  return { userId: meta.user_id, projectId: row.id, sceneId: meta.scene_id };
}

export function isSceneRefBusy(projectId: string, sceneId: string): boolean {
  return countPendingSceneRefJobs(projectId, sceneId) > 0;
}
