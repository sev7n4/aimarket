import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";

/** 为用户创建默认个人工作区（Phase 6 多租户基础） */
export function ensurePersonalWorkspace(userId: string): string {
  const existing = db
    .prepare(
      `SELECT w.id FROM workspaces w
       JOIN workspace_members m ON m.workspace_id = w.id
       WHERE m.user_id = ? AND w.is_personal = 1 LIMIT 1`,
    )
    .get(userId) as { id: string } | undefined;
  if (existing) return existing.id;

  const workspaceId = randomUUID();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO workspaces (id, name, owner_id, is_personal) VALUES (?, ?, ?, 1)`,
    ).run(workspaceId, "个人空间", userId);
    db.prepare(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')`,
    ).run(workspaceId, userId);
  });
  return workspaceId;
}

export function getUserDefaultWorkspaceId(userId: string): string {
  return ensurePersonalWorkspace(userId);
}
