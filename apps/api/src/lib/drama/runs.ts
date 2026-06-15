import { randomUUID } from "node:crypto";
import { db } from "../../db/index.js";
import { AppError } from "../errors.js";
import {
  DRAMA_CONFIRM_POINTS_THRESHOLD,
  estimateDramaPoints,
} from "./estimate.js";
import type { DramaProgress, DramaRunStatus } from "./schema.js";
import { DRAMA_PIPELINE_STEPS } from "./schema.js";
import {
  getDramaProject,
  parseProjectJson,
  type DramaProjectRow,
  updateDramaProject,
} from "./projects.js";

export interface DramaRunRow {
  id: string;
  project_id: string;
  session_id: string;
  user_id: string;
  skill_id: string;
  status: DramaRunStatus;
  current_step_index: number;
  pending_job_id: string | null;
  progress_json: string | null;
  step_outputs_json: string | null;
  estimated_points: number;
  final_video_url: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export function defaultProgress(): DramaProgress {
  return {
    currentPipelineStep: DRAMA_PIPELINE_STEPS[0]!,
    charRefIndex: 0,
    charRefAngleIndex: 0,
    sceneRefIndex: 0,
    shotIndex: 0,
    ttsIndex: 0,
    lipsyncIndex: 0,
    keyframeRetries: {},
    pendingBatch: [],
  };
}

export function parseProgress(row: DramaRunRow): DramaProgress {
  if (!row.progress_json) return defaultProgress();
  try {
    return { ...defaultProgress(), ...JSON.parse(row.progress_json) };
  } catch {
    return defaultProgress();
  }
}

export function createDramaRun(input: {
  sessionId: string;
  userId: string;
  projectId: string;
  confirmed?: boolean;
}): DramaRunRow {
  const projectRow = getDramaProject(input.userId, input.projectId);
  if (!projectRow) {
    throw new AppError(404, "NOT_FOUND", "短剧项目不存在");
  }
  const project = parseProjectJson(projectRow);
  const estimated = estimateDramaPoints(project);
  const requiresConfirm =
    estimated >= DRAMA_CONFIRM_POINTS_THRESHOLD && !input.confirmed;

  const id = randomUUID();
  const status: DramaRunStatus = requiresConfirm ? "waiting_confirm" : "queued";

  db.prepare(
    `INSERT INTO drama_runs
     (id, project_id, session_id, user_id, skill_id, status, current_step_index,
      progress_json, estimated_points, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'drama-short-v1', ?, 0, ?, ?, datetime('now'), datetime('now'))`,
  ).run(
    id,
    input.projectId,
    input.sessionId,
    input.userId,
    status,
    JSON.stringify(defaultProgress()),
    estimated,
  );

  if (!requiresConfirm) {
    updateDramaProject(input.projectId, { status: "producing" });
  }

  const row = getDramaRun(input.userId, id);
  if (!row) throw new AppError(500, "INTERNAL_ERROR", "创建短剧 Run 失败");
  return row;
}

export function getDramaRun(
  userId: string,
  runId: string,
): DramaRunRow | undefined {
  return db
    .prepare(`SELECT * FROM drama_runs WHERE id = ? AND user_id = ?`)
    .get(runId, userId) as DramaRunRow | undefined;
}

export function getDramaRunByJobId(jobId: string): DramaRunRow | undefined {
  const link = db
    .prepare(`SELECT drama_run_id FROM drama_run_jobs WHERE job_id = ?`)
    .get(jobId) as { drama_run_id: string } | undefined;
  if (!link) return undefined;
  return db
    .prepare(`SELECT * FROM drama_runs WHERE id = ?`)
    .get(link.drama_run_id) as DramaRunRow | undefined;
}

export function linkDramaRunJob(
  dramaRunId: string,
  jobId: string,
  stepId: string,
  shotId?: string,
) {
  db.prepare(
    `INSERT OR IGNORE INTO drama_run_jobs (drama_run_id, job_id, step_id, shot_id) VALUES (?, ?, ?, ?)`,
  ).run(dramaRunId, jobId, stepId, shotId ?? null);
}

export function getDramaRunJobMeta(jobId: string) {
  return db
    .prepare(
      `SELECT drama_run_id, job_id, step_id, shot_id FROM drama_run_jobs WHERE job_id = ?`,
    )
    .get(jobId) as
    | {
        drama_run_id: string;
        job_id: string;
        step_id: string;
        shot_id: string | null;
      }
    | undefined;
}

export function updateDramaRun(
  runId: string,
  patch: Partial<{
    status: DramaRunStatus;
    currentStepIndex: number;
    pendingJobId: string | null;
    progress: DramaProgress;
    finalVideoUrl: string | null;
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
  if (patch.progress !== undefined) {
    sets.push("progress_json = ?");
    params.push(JSON.stringify(patch.progress));
  }
  if (patch.finalVideoUrl !== undefined) {
    sets.push("final_video_url = ?");
    params.push(patch.finalVideoUrl);
  }
  if (patch.error !== undefined) {
    sets.push("error = ?");
    params.push(patch.error);
  }
  params.push(runId);
  db.prepare(`UPDATE drama_runs SET ${sets.join(", ")} WHERE id = ?`).run(
    ...params,
  );
}

export function serializeDramaRun(row: DramaRunRow, projectRow: DramaProjectRow) {
  const progress = parseProgress(row);
  const project = parseProjectJson(projectRow);
  const stepIndex = row.current_step_index;

  return {
    id: row.id,
    projectId: row.project_id,
    sessionId: row.session_id,
    skillId: row.skill_id,
    status: row.status,
    estimatedPoints: row.estimated_points,
    confirmIfPointsOver: DRAMA_CONFIRM_POINTS_THRESHOLD,
    currentStepIndex: stepIndex,
    pendingJobId: row.pending_job_id,
    finalVideoUrl: row.final_video_url,
    error: row.error,
    progress,
    project,
    pipelineSteps: DRAMA_PIPELINE_STEPS.map((step, i) => ({
      id: step,
      label: pipelineStepLabel(step),
      index: i,
      done: i < stepIndex,
      current:
        i === stepIndex &&
        !["completed", "failed", "cancelled", "waiting_confirm"].includes(
          row.status,
        ),
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function pipelineStepLabel(step: string): string {
  const labels: Record<string, string> = {
    char_refs: "角色定稿板（Anchor First）",
    scene_refs: "场景定稿",
    keyframes: "分镜关键帧",
    shot_videos: "逐镜视频",
    tts: "对白配音",
    lipsync: "口型同步",
    concat: "剪辑合成",
  };
  return labels[step] ?? step;
}
