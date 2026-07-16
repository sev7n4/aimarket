import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db/index.js";
import { sessionKindSchema } from "./session-kind.js";
import type { SessionRecord } from "./session-access.js";
import { resolveWorkspaceIdForUser } from "./workspaces.js";

export const openSessionModeSchema = z.enum(["chat", "image"]);

export const openSessionCreateBodySchema = z.object({
  mode: openSessionModeSchema.default("image"),
  title: z.string().trim().min(1).max(100).optional(),
  kind: sessionKindSchema.default("canvas"),
  workspaceId: z.string().uuid().optional(),
});

export function serializeOpenSession(session: SessionRecord) {
  return {
    id: session.id,
    title: session.title,
    mode: session.mode,
    kind: session.kind,
    status: session.status,
    workspaceId: session.workspace_id ?? undefined,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  };
}

export function createOpenSession(
  userId: string,
  input: z.infer<typeof openSessionCreateBodySchema>,
) {
  const id = randomUUID();
  const title =
    input.title ??
    (input.kind === "project" ? "新建项目" : "新建画布");
  const workspaceId = resolveWorkspaceIdForUser(userId, input.workspaceId);

  db.prepare(
    `INSERT INTO image_sessions (id, user_id, workspace_id, title, mode, kind)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, userId, workspaceId, title, input.mode, input.kind);

  const row = db
    .prepare(
      `SELECT id, user_id, workspace_id, title, mode, kind, status, created_at, updated_at
       FROM image_sessions WHERE id = ?`,
    )
    .get(id) as SessionRecord;

  return serializeOpenSession(row);
}
