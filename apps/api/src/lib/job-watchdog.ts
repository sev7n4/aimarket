import { db } from "../db/index.js";
import { getModel } from "./models.js";
import { markGenerationJobFailed } from "./job-fail.js";

const DEFAULT_JOB_MAX_RUNNING_MS = Number(
  process.env.JOB_MAX_RUNNING_MS ?? 900_000,
);
const VIDEO_POLL_TIMEOUT_MS = Number(
  process.env.AGNES_VIDEO_POLL_TIMEOUT_MS ?? 900_000,
);
const VIDEO_WATCHDOG_BUFFER_MS = Number(
  process.env.JOB_WATCHDOG_VIDEO_BUFFER_MS ?? 120_000,
);
const JOB_MAX_QUEUED_MS = Number(process.env.JOB_MAX_QUEUED_MS ?? 900_000);
const SWEEP_INTERVAL_MS = Number(
  process.env.JOB_WATCHDOG_SWEEP_INTERVAL_MS ?? 60_000,
);

export function parseJobTimestampMs(createdAt: string): number {
  const normalized = createdAt.includes("T")
    ? createdAt
    : `${createdAt.replace(" ", "T")}Z`;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

/** 按任务类型计算 running/queued 最长允许耗时（毫秒） */
export function jobMaxRunningMs(input: {
  toolType?: string | null;
  modelId?: string;
}): number {
  const model = getModel(input.modelId ?? "");
  const isVideo =
    input.toolType === "video" || model?.type === "video";
  if (isVideo) {
    return VIDEO_POLL_TIMEOUT_MS + VIDEO_WATCHDOG_BUFFER_MS;
  }
  return DEFAULT_JOB_MAX_RUNNING_MS;
}

export function isStaleGenerationJob(
  row: {
    status: string;
    created_at: string;
    tool_type?: string | null;
    model_id?: string;
  },
  nowMs = Date.now(),
): boolean {
  if (row.status !== "running" && row.status !== "queued") return false;
  const startedMs = parseJobTimestampMs(row.created_at);
  const elapsed = Math.max(0, nowMs - startedMs);
  const limit =
    row.status === "queued"
      ? JOB_MAX_QUEUED_MS
      : jobMaxRunningMs({
          toolType: row.tool_type,
          modelId: row.model_id,
        });
  return elapsed > limit;
}

function staleJobMessage(row: {
  status: string;
  tool_type?: string | null;
  model_id?: string;
}): string {
  const model = getModel(row.model_id ?? "");
  const isVideo =
    row.tool_type === "video" || model?.type === "video";
  if (isVideo) {
    return "视频生成超时（上游队列繁忙或未在时限内返回结果），积分已退回。可稍后重试或切换模型。";
  }
  return "生成任务超时，积分已退回";
}

/** 将僵尸 queued/running 任务标记失败并退积分；返回是否处理了该 job */
export function reconcileStaleGenerationJob(jobId: string): boolean {
  const row = db
    .prepare(
      `SELECT id, session_id, user_id, status, points_cost, created_at, tool_type, model_id
       FROM generation_jobs WHERE id = ?`,
    )
    .get(jobId) as
    | {
        id: string;
        session_id: string;
        user_id: string;
        status: string;
        points_cost: number;
        created_at: string;
        tool_type: string | null;
        model_id: string;
      }
    | undefined;

  if (!row || !isStaleGenerationJob(row)) return false;

  markGenerationJobFailed(jobId, staleJobMessage(row), "JOB_TIMEOUT");
  return true;
}

export function sweepStaleGenerationJobs(): number {
  const rows = db
    .prepare(
      `SELECT id FROM generation_jobs WHERE status IN ('queued', 'running')`,
    )
    .all() as { id: string }[];

  let count = 0;
  for (const row of rows) {
    if (reconcileStaleGenerationJob(row.id)) count += 1;
  }
  return count;
}

let sweepTimer: ReturnType<typeof setInterval> | null = null;

export function startJobWatchdog() {
  const swept = sweepStaleGenerationJobs();
  if (swept > 0) {
    console.log(`[job-watchdog] swept ${swept} stale job(s) on startup`);
  }
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    const n = sweepStaleGenerationJobs();
    if (n > 0) console.log(`[job-watchdog] swept ${n} stale job(s)`);
  }, SWEEP_INTERVAL_MS);
  sweepTimer.unref?.();
}
