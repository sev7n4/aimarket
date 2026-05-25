import { randomBytes, randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { AppError } from "./errors.js";

export type WorkspaceRole = "owner" | "admin" | "member";

export function getWorkspaceRole(
  userId: string,
  workspaceId: string,
): WorkspaceRole | null {
  const row = db
    .prepare(
      `SELECT m.role, w.is_personal FROM workspace_members m
       JOIN workspaces w ON w.id = m.workspace_id
       WHERE m.workspace_id = ? AND m.user_id = ?`,
    )
    .get(workspaceId, userId) as
    | { role: WorkspaceRole; is_personal: number }
    | undefined;
  if (!row) return null;
  return row.role;
}

export function requireWorkspaceRole(
  userId: string,
  workspaceId: string,
  allowed: WorkspaceRole[],
) {
  const role = getWorkspaceRole(userId, workspaceId);
  if (!role || !allowed.includes(role)) {
    throw new AppError(403, "FORBIDDEN", "无权操作该工作区");
  }
  return role;
}

function generateInviteCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export function createWorkspaceInvite(
  workspaceId: string,
  createdBy: string,
  options?: { role?: "member" | "admin"; maxUses?: number; expiresInDays?: number },
) {
  const ws = db
    .prepare(`SELECT is_personal FROM workspaces WHERE id = ?`)
    .get(workspaceId) as { is_personal: number } | undefined;
  if (!ws) throw new AppError(404, "NOT_FOUND", "工作区不存在");
  if (ws.is_personal) {
    throw new AppError(400, "PERSONAL_WORKSPACE", "个人空间不支持邀请成员");
  }

  requireWorkspaceRole(createdBy, workspaceId, ["owner", "admin"]);

  const role = options?.role ?? "member";
  const maxUses = options?.maxUses ?? null;
  let expiresAt: string | null = null;
  if (options?.expiresInDays) {
    const d = new Date();
    d.setDate(d.getDate() + options.expiresInDays);
    expiresAt = d.toISOString();
  }

  let code = generateInviteCode();
  for (let i = 0; i < 5; i++) {
    const exists = db
      .prepare("SELECT id FROM workspace_invites WHERE code = ?")
      .get(code);
    if (!exists) break;
    code = generateInviteCode();
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO workspace_invites (id, workspace_id, code, created_by, role, max_uses, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, workspaceId, code, createdBy, role, maxUses, expiresAt);

  return { id, code, role, maxUses, expiresAt };
}

export function joinWorkspaceByCode(userId: string, code: string) {
  const normalized = code.trim().toUpperCase();
  const invite = db
    .prepare(
      `SELECT i.id, i.workspace_id, i.role, i.max_uses, i.use_count, i.expires_at,
              w.name as workspace_name, w.is_personal
       FROM workspace_invites i
       JOIN workspaces w ON w.id = i.workspace_id
       WHERE i.code = ?`,
    )
    .get(normalized) as
    | {
        id: string;
        workspace_id: string;
        role: WorkspaceRole;
        max_uses: number | null;
        use_count: number;
        expires_at: string | null;
        workspace_name: string;
        is_personal: number;
      }
    | undefined;

  if (!invite) {
    throw new AppError(404, "INVITE_NOT_FOUND", "邀请码无效或已过期");
  }
  if (invite.is_personal) {
    throw new AppError(400, "INVALID_INVITE", "无法加入个人空间");
  }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    throw new AppError(400, "INVITE_EXPIRED", "邀请码已过期");
  }
  if (invite.max_uses != null && invite.use_count >= invite.max_uses) {
    throw new AppError(400, "INVITE_EXHAUSTED", "邀请码已达使用上限");
  }

  const existing = db
    .prepare(
      `SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?`,
    )
    .get(invite.workspace_id, userId) as { role: string } | undefined;

  if (existing) {
    return {
      workspaceId: invite.workspace_id,
      workspaceName: invite.workspace_name,
      role: existing.role,
      alreadyMember: true,
    };
  }

  db.transaction(() => {
    db.prepare(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)`,
    ).run(invite.workspace_id, userId, invite.role);
    db.prepare(
      `UPDATE workspace_invites SET use_count = use_count + 1 WHERE id = ?`,
    ).run(invite.id);
  });

  return {
    workspaceId: invite.workspace_id,
    workspaceName: invite.workspace_name,
    role: invite.role,
    alreadyMember: false,
  };
}

export function listWorkspaceMembers(workspaceId: string, userId: string) {
  requireWorkspaceRole(userId, workspaceId, ["owner", "admin", "member"]);
  return db
    .prepare(
      `SELECT u.id, u.email, m.role, m.workspace_id
       FROM workspace_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.workspace_id = ?
       ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.email`,
    )
    .all(workspaceId) as {
    id: string;
    email: string;
    role: WorkspaceRole;
    workspace_id: string;
  }[];
}

export function removeWorkspaceMember(
  workspaceId: string,
  actorId: string,
  targetUserId: string,
) {
  requireWorkspaceRole(actorId, workspaceId, ["owner", "admin"]);

  const target = db
    .prepare(
      `SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?`,
    )
    .get(workspaceId, targetUserId) as { role: WorkspaceRole } | undefined;
  if (!target) {
    throw new AppError(404, "NOT_FOUND", "成员不存在");
  }
  if (target.role === "owner") {
    throw new AppError(400, "CANNOT_REMOVE_OWNER", "不能移除工作区所有者");
  }

  const actorRole = getWorkspaceRole(actorId, workspaceId);
  if (actorRole === "admin" && target.role === "admin") {
    throw new AppError(403, "FORBIDDEN", "管理员无法移除其他管理员");
  }

  db.prepare(
    `DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?`,
  ).run(workspaceId, targetUserId);
}
