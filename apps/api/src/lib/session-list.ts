import { db } from "../db/index.js";
import { isPersonalWorkspace, mapSessionForUser } from "./session-access.js";
import { userHasWorkspaceAccess } from "./workspaces.js";
import { AppError } from "./errors.js";
import { HIDE_EMPTY_AUTO_TITLED_SESSIONS_SQL } from "./session-empty.js";

export function listSessionsForUser(
  userId: string,
  options: { limit: number; workspaceId?: string; kind?: string },
) {
  const { limit, workspaceId, kind } = options;

  if (workspaceId) {
    if (!userHasWorkspaceAccess(userId, workspaceId)) {
      throw new AppError(403, "FORBIDDEN", "无权访问该工作区");
    }

    const personal = isPersonalWorkspace(workspaceId);
    let rows: Record<string, unknown>[];

    if (personal && kind) {
      rows = db
        .prepare(
          `SELECT s.id, s.title, s.mode, s.kind, s.status, s.updated_at, s.user_id, s.workspace_id, u.email AS creator_email
           FROM image_sessions s
           LEFT JOIN users u ON u.id = s.user_id
           WHERE s.workspace_id = ? AND s.user_id = ? AND s.kind = ?
           ${HIDE_EMPTY_AUTO_TITLED_SESSIONS_SQL}
           ORDER BY s.updated_at DESC LIMIT ?`,
        )
        .all(workspaceId, userId, kind, limit) as Record<string, unknown>[];
    } else if (personal) {
      rows = db
        .prepare(
          `SELECT s.id, s.title, s.mode, s.kind, s.status, s.updated_at, s.user_id, s.workspace_id, u.email AS creator_email
           FROM image_sessions s
           LEFT JOIN users u ON u.id = s.user_id
           WHERE s.workspace_id = ? AND s.user_id = ?
           ${HIDE_EMPTY_AUTO_TITLED_SESSIONS_SQL}
           ORDER BY s.updated_at DESC LIMIT ?`,
        )
        .all(workspaceId, userId, limit) as Record<string, unknown>[];
    } else if (kind) {
      rows = db
        .prepare(
          `SELECT s.id, s.title, s.mode, s.kind, s.status, s.updated_at, s.user_id, s.workspace_id, u.email AS creator_email
           FROM image_sessions s
           LEFT JOIN users u ON u.id = s.user_id
           WHERE s.workspace_id = ? AND s.kind = ?
           ${HIDE_EMPTY_AUTO_TITLED_SESSIONS_SQL}
           ORDER BY s.updated_at DESC LIMIT ?`,
        )
        .all(workspaceId, kind, limit) as Record<string, unknown>[];
    } else {
      rows = db
        .prepare(
          `SELECT s.id, s.title, s.mode, s.kind, s.status, s.updated_at, s.user_id, s.workspace_id, u.email AS creator_email
           FROM image_sessions s
           LEFT JOIN users u ON u.id = s.user_id
           WHERE s.workspace_id = ?
           ${HIDE_EMPTY_AUTO_TITLED_SESSIONS_SQL}
           ORDER BY s.updated_at DESC LIMIT ?`,
        )
        .all(workspaceId, limit) as Record<string, unknown>[];
    }

    return rows.map((row) =>
      mapSessionForUser(row as Parameters<typeof mapSessionForUser>[0], userId, {
        creator_email: row.creator_email,
      }),
    );
  }

  let rows: Record<string, unknown>[];
  if (kind) {
    rows = db
      .prepare(
        `SELECT s.id, s.title, s.mode, s.kind, s.status, s.updated_at, s.user_id, s.workspace_id, u.email AS creator_email
         FROM image_sessions s
         LEFT JOIN users u ON u.id = s.user_id
         WHERE s.user_id = ? AND s.kind = ?
         ${HIDE_EMPTY_AUTO_TITLED_SESSIONS_SQL}
         ORDER BY s.updated_at DESC LIMIT ?`,
      )
      .all(userId, kind, limit) as Record<string, unknown>[];
  } else {
    rows = db
      .prepare(
        `SELECT s.id, s.title, s.mode, s.kind, s.status, s.updated_at, s.user_id, s.workspace_id, u.email AS creator_email
         FROM image_sessions s
         LEFT JOIN users u ON u.id = s.user_id
         WHERE s.user_id = ?
         ${HIDE_EMPTY_AUTO_TITLED_SESSIONS_SQL}
         ORDER BY s.updated_at DESC LIMIT ?`,
      )
      .all(userId, limit) as Record<string, unknown>[];
  }

  return rows.map((row) =>
    mapSessionForUser(row as Parameters<typeof mapSessionForUser>[0], userId, {
      creator_email: row.creator_email,
    }),
  );
}
