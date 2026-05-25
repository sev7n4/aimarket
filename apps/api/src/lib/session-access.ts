import { db } from "../db/index.js";
import { AppError } from "./errors.js";
import { getWorkspaceRole } from "./workspace-members.js";
import { userHasWorkspaceAccess } from "./workspaces.js";

export type SessionRecord = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  title: string;
  mode: string;
  kind: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export function getSessionById(sessionId: string): SessionRecord | null {
  const row = db
    .prepare(
      `SELECT id, user_id, workspace_id, title, mode, kind, status, created_at, updated_at
       FROM image_sessions WHERE id = ?`,
    )
    .get(sessionId) as SessionRecord | undefined;
  return row ?? null;
}

export function isPersonalWorkspace(workspaceId: string): boolean {
  const row = db
    .prepare("SELECT is_personal FROM workspaces WHERE id = ?")
    .get(workspaceId) as { is_personal: number } | undefined;
  return row?.is_personal === 1;
}

/** 方案 B：团队空间全员可见；个人空间仅创建者可见 */
export type SessionAccessFields = Pick<
  SessionRecord,
  "id" | "user_id" | "workspace_id"
>;

export function canReadSession(
  userId: string,
  session: SessionAccessFields,
): boolean {
  if (!session.workspace_id) {
    return session.user_id === userId;
  }
  if (!userHasWorkspaceAccess(userId, session.workspace_id)) {
    return false;
  }
  if (isPersonalWorkspace(session.workspace_id)) {
    return session.user_id === userId;
  }
  return true;
}

/** 创建者可改；团队空间 owner/admin 可改任意会话 */
export function canWriteSession(
  userId: string,
  session: SessionAccessFields,
): boolean {
  if (!session.workspace_id) {
    return session.user_id === userId;
  }
  if (!userHasWorkspaceAccess(userId, session.workspace_id)) {
    return false;
  }
  const role = getWorkspaceRole(userId, session.workspace_id);
  if (role === "owner" || role === "admin") {
    return true;
  }
  return session.user_id === userId;
}

export function assertSessionRead(userId: string, sessionId: string): SessionRecord {
  const session = getSessionById(sessionId);
  if (!session || !canReadSession(userId, session)) {
    throw new AppError(404, "NOT_FOUND", "会话不存在");
  }
  return session;
}

export function assertSessionWrite(userId: string, sessionId: string): SessionRecord {
  const session = assertSessionRead(userId, sessionId);
  if (!canWriteSession(userId, session)) {
    throw new AppError(403, "FORBIDDEN", "仅创建者或管理员可编辑此会话");
  }
  return session;
}

export function mapSessionForUser(
  session: SessionRecord | (SessionAccessFields & Record<string, unknown>),
  userId: string,
  extra?: Record<string, unknown>,
) {
  const canEdit = canWriteSession(userId, session);
  return {
    ...session,
    ...extra,
    can_edit: canEdit,
    is_read_only: !canEdit,
  };
}
