import { randomUUID } from "node:crypto";
import { db } from "../../db/index.js";
import { AppError } from "../errors.js";
import { notifyOpenPlanWebhook } from "../open-webhooks.js";
import {
  DRAMA_PLAN_AGENT_ORDER,
  type DramaPlanAgentId,
  type DramaPlanAgentsJson,
  type DramaPlanRunStatus,
} from "./planner/types.js";
import type { DramaProjectType } from "./schema.js";
import { estimateDramaPoints } from "./estimate.js";
import {
  getDramaProject,
  serializeDramaProject,
} from "./projects.js";

export interface DramaPlanRunRow {
  id: string;
  session_id: string;
  user_id: string;
  user_idea: string;
  target_duration_sec: number | null;
  aspect_ratio: string | null;
  status: DramaPlanRunStatus;
  current_agent: string | null;
  agents_json: string;
  reasoning_json: string | null;
  project_id: string | null;
  auto_produce: number;
  project_type: string;
  refine_instruction: string | null;
  base_project_id: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export function defaultAgentsJson(): DramaPlanAgentsJson {
  return Object.fromEntries(
    DRAMA_PLAN_AGENT_ORDER.map((id) => [id, { status: "pending" as const }]),
  ) as DramaPlanAgentsJson;
}

export function parseAgentsJson(row: DramaPlanRunRow): DramaPlanAgentsJson {
  try {
    return { ...defaultAgentsJson(), ...JSON.parse(row.agents_json) };
  } catch {
    return defaultAgentsJson();
  }
}

export function parseReasoningJson(
  row: DramaPlanRunRow,
): Partial<Record<DramaPlanAgentId, string>> {
  if (!row.reasoning_json) return {};
  try {
    return JSON.parse(row.reasoning_json);
  } catch {
    return {};
  }
}

export function createDramaPlanRun(input: {
  sessionId: string;
  userId: string;
  userIdea: string;
  targetDurationSec?: number;
  aspectRatio?: "9:16" | "16:9";
  autoProduce?: boolean;
  projectType?: DramaProjectType;
  /** 多轮迭代：refine 指令（存在时表示本 Run 为对既有方案的改写） */
  refineInstruction?: string;
  /** 多轮迭代：被改写的既有项目 id（refine 时同时作为 project_id 复用） */
  baseProjectId?: string;
}): DramaPlanRunRow {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO drama_plan_runs
     (id, session_id, user_id, user_idea, target_duration_sec, aspect_ratio,
      status, agents_json, auto_produce, project_type,
      refine_instruction, base_project_id, project_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'planning', ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
  ).run(
    id,
    input.sessionId,
    input.userId,
    input.userIdea,
    input.targetDurationSec ?? null,
    input.aspectRatio ?? null,
    JSON.stringify(defaultAgentsJson()),
    input.autoProduce ? 1 : 0,
    input.projectType ?? "short_drama",
    input.refineInstruction ?? null,
    input.baseProjectId ?? null,
    // refine 直接复用既有 project_id，规划完成后原地更新并写新版本
    input.baseProjectId ?? null,
  );
  const row = getDramaPlanRun(input.userId, id);
  if (!row) throw new AppError(500, "INTERNAL_ERROR", "创建规划 Run 失败");
  return row;
}

export function getDramaPlanRun(
  userId: string,
  runId: string,
): DramaPlanRunRow | undefined {
  return db
    .prepare(`SELECT * FROM drama_plan_runs WHERE id = ? AND user_id = ?`)
    .get(runId, userId) as DramaPlanRunRow | undefined;
}

export function updateDramaPlanRun(
  runId: string,
  patch: Partial<{
    status: DramaPlanRunStatus;
    currentAgent: DramaPlanAgentId | null;
    agents: DramaPlanAgentsJson;
    reasoning: Partial<Record<DramaPlanAgentId, string>>;
    projectId: string | null;
    error: string | null;
  }>,
) {
  const sets = ["updated_at = datetime('now')"];
  const params: (string | number | null)[] = [];

  if (patch.status !== undefined) {
    sets.push("status = ?");
    params.push(patch.status);
  }
  if (patch.currentAgent !== undefined) {
    sets.push("current_agent = ?");
    params.push(patch.currentAgent);
  }
  if (patch.agents !== undefined) {
    sets.push("agents_json = ?");
    params.push(JSON.stringify(patch.agents));
  }
  if (patch.reasoning !== undefined) {
    sets.push("reasoning_json = ?");
    params.push(JSON.stringify(patch.reasoning));
  }
  if (patch.projectId !== undefined) {
    sets.push("project_id = ?");
    params.push(patch.projectId);
  }
  if (patch.error !== undefined) {
    sets.push("error = ?");
    params.push(patch.error);
  }
  params.push(runId);
  db.prepare(`UPDATE drama_plan_runs SET ${sets.join(", ")} WHERE id = ?`).run(
    ...params,
  );

  if (patch.status === "completed" || patch.status === "failed") {
    const row = db
      .prepare(
        `SELECT id, session_id, project_id, status, error, user_id
         FROM drama_plan_runs WHERE id = ?`,
      )
      .get(runId) as
      | {
          id: string;
          session_id: string;
          project_id: string | null;
          status: string;
          error: string | null;
          user_id: string;
        }
      | undefined;
    if (row) notifyOpenPlanWebhook(row.user_id, row);
  }
}

export function serializeDramaPlanRun(row: DramaPlanRunRow) {
  const agents = parseAgentsJson(row);
  const reasoning = parseReasoningJson(row);
  const projectRow = row.project_id
    ? getDramaProject(row.user_id, row.project_id)
    : undefined;
  const estimatedPoints = projectRow
    ? estimateDramaPoints(JSON.parse(projectRow.project_json))
    : undefined;

  return {
    id: row.id,
    sessionId: row.session_id,
    userIdea: row.user_idea,
    targetDurationSec: row.target_duration_sec ?? undefined,
    aspectRatio: (row.aspect_ratio as "9:16" | "16:9" | null) ?? undefined,
    status: row.status,
    currentAgent: row.current_agent as DramaPlanAgentId | null,
    agents,
    reasoning,
    projectId: row.project_id,
    project: projectRow ? serializeDramaProject(projectRow) : undefined,
    estimatedPoints,
    autoProduce: Boolean(row.auto_produce),
    projectType: (row.project_type as DramaProjectType) ?? "short_drama",
    refineInstruction: row.refine_instruction ?? undefined,
    baseProjectId: row.base_project_id ?? undefined,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function resetDownstreamAgents(
  agents: DramaPlanAgentsJson,
  fromAgent: DramaPlanAgentId,
): DramaPlanAgentsJson {
  const startIdx = DRAMA_PLAN_AGENT_ORDER.indexOf(fromAgent);
  const next = { ...agents };
  for (let i = startIdx; i < DRAMA_PLAN_AGENT_ORDER.length; i++) {
    const id = DRAMA_PLAN_AGENT_ORDER[i]!;
    next[id] = { status: "pending" };
  }
  return next;
}

export function resetPlanRunForRerun(
  runId: string,
  fromAgent: DramaPlanAgentId,
  agents: DramaPlanAgentsJson,
) {
  updateDramaPlanRun(runId, {
    status: "planning",
    currentAgent: fromAgent,
    agents: resetDownstreamAgents(agents, fromAgent),
    error: null,
  });
}
