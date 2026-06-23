import { randomUUID } from "node:crypto";
import { db } from "../../db/index.js";
import { AppError } from "../errors.js";
import type {
  DramaProjectData,
  DramaProjectStatus,
  CharacterCard,
} from "./schema.js";
import { resolveReferenceUrls } from "../references.js";

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
  db.prepare(
    `INSERT INTO drama_projects
     (id, session_id, user_id, user_idea, project_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'waiting_confirm', datetime('now'), datetime('now'))`,
  ).run(
    id,
    input.sessionId,
    input.userId,
    input.project.userIdea,
    JSON.stringify(input.project),
  );
  const row = getDramaProject(input.userId, id);
  if (!row) throw new AppError(500, "INTERNAL_ERROR", "创建短剧项目失败");
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

export function updateDramaProject(
  projectId: string,
  patch: {
    project?: DramaProjectData;
    status?: DramaProjectStatus;
  },
) {
  const sets = ["updated_at = datetime('now')"];
  const params: (string | null)[] = [];

  if (patch.project !== undefined) {
    sets.push("project_json = ?");
    params.push(JSON.stringify(patch.project));
  }
  if (patch.status !== undefined) {
    sets.push("status = ?");
    params.push(patch.status);
  }
  params.push(projectId);
  db.prepare(`UPDATE drama_projects SET ${sets.join(", ")} WHERE id = ?`).run(
    ...params,
  );
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
