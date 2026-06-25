import { randomUUID } from "node:crypto";
import { db } from "../../db/index.js";
import { AppError } from "../errors.js";
import type {
  DramaProjectData,
  DramaProjectStatus,
  CharacterCard,
} from "./schema.js";
import { resolveReferenceUrls } from "../references.js";
import { snapshotInitialVersion, snapshotAfterUpdate } from "./project-versions.js";

function enrichCharacterCard(char: CharacterCard) {
  const ids = char.refOutputIds;
  const refUrls = ids
    ? {
        front: ids.front
          ? resolveReferenceUrls([ids.front])[0]
          : undefined,
        three_quarter: ids.three_quarter
          ? resolveReferenceUrls([ids.three_quarter])[0]
          : undefined,
        side: ids.side ? resolveReferenceUrls([ids.side])[0] : undefined,
      }
    : undefined;
  return {
    ...char,
    turnaroundStatus: char.turnaroundStatus ?? "draft",
    refUrls,
  };
}

function enrichProjectCharacters(project: DramaProjectData): DramaProjectData {
  return {
    ...project,
    characters: project.characters.map(enrichCharacterCard),
  };
}

export interface DramaProjectRow {
  id: string;
  session_id: string;
  user_id: string;
  user_idea: string;
  project_json: string;
  status: DramaProjectStatus;
  created_at: string;
  updated_at: string;
}

export function parseProjectJson(row: DramaProjectRow): DramaProjectData {
  return JSON.parse(row.project_json) as DramaProjectData;
}

export function createDramaProject(input: {
  sessionId: string;
  userId: string;
  project: DramaProjectData;
}): DramaProjectRow {
  const id = randomUUID();
  const projectJson = JSON.stringify(input.project);
  db.prepare(
    `INSERT INTO drama_projects
     (id, session_id, user_id, user_idea, project_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'waiting_confirm', datetime('now'), datetime('now'))`,
  ).run(
    id,
    input.sessionId,
    input.userId,
    input.project.userIdea,
    projectJson,
  );
  const row = getDramaProject(input.userId, id);
  if (!row) throw new AppError(500, "INTERNAL_ERROR", "创建短剧项目失败");
  // PROD-C07 — 写入初始版本快照
  try {
    snapshotInitialVersion(id, input.userId, projectJson);
  } catch (err) {
    console.warn("[project-versions] snapshotInitialVersion failed:", err);
  }
  return row;
}

export function getDramaProject(
  userId: string,
  projectId: string,
): DramaProjectRow | undefined {
  return db
    .prepare(`SELECT * FROM drama_projects WHERE id = ? AND user_id = ?`)
    .get(projectId, userId) as DramaProjectRow | undefined;
}

/**
 * 更新短剧项目。
 *
 * PROD-C07 行为：当 patch.project 不为 undefined 且 options.userId 提供时，
 * 在 UPDATE 之后写入一条「当前新状态」的快照到 drama_project_versions，
 * trigger 默认为 manual_patch。每个版本代表「该时刻 project 的状态」。
 *
 * @param options.snapshotTrigger 覆盖默认 trigger（如 timeline 编辑可用 "auto_save"）
 * @param options.snapshotNote 可选备注
 * @param options.skipSnapshot 设为 true 时跳过自动 snapshot（仅 restore 流程内部使用）
 * @param options.userId 触发更新的用户 ID，必填才会触发 snapshot
 */
export function updateDramaProject(
  projectId: string,
  patch: {
    project?: DramaProjectData;
    status?: DramaProjectStatus;
  },
  options?: {
    snapshotTrigger?: "manual_patch" | "auto_save";
    snapshotNote?: string | null;
    skipSnapshot?: boolean;
    userId?: string;
  },
) {
  const sets = ["updated_at = datetime('now')"];
  const params: (string | null)[] = [];

  let newProjectJson: string | null = null;
  if (patch.project !== undefined) {
    newProjectJson = JSON.stringify(patch.project);
    sets.push("project_json = ?");
    params.push(newProjectJson);
  }
  if (patch.status !== undefined) {
    sets.push("status = ?");
    params.push(patch.status);
  }
  params.push(projectId);
  db.prepare(`UPDATE drama_projects SET ${sets.join(", ")} WHERE id = ?`).run(
    ...params,
  );

  // PROD-C07 — 在 UPDATE 成功后写入「当前新状态」的版本快照
  if (
    !options?.skipSnapshot &&
    newProjectJson !== null &&
    options?.userId
  ) {
    try {
      snapshotAfterUpdate({
        projectId,
        userId: options.userId,
        currentProjectJson: newProjectJson,
        trigger: options.snapshotTrigger ?? "manual_patch",
        note: options.snapshotNote ?? null,
      });
    } catch (err) {
      console.warn("[project-versions] snapshotAfterUpdate failed:", err);
    }
  }
}

export function serializeDramaProject(row: DramaProjectRow) {
  const project = enrichProjectCharacters(parseProjectJson(row));
  return {
    id: row.id,
    sessionId: row.session_id,
    userIdea: row.user_idea,
    status: row.status,
    project,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
