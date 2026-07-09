import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db/index.js";
import { AppError } from "./errors.js";
import { serializeCanvasLayout } from "./canvas-layout.js";
import {
  createSessionShareLink,
  getSessionShareStatus,
  resolvePublicShare,
  revokeSessionShare,
} from "./session-share.js";
import { assertSessionWrite, mapSessionForUser } from "./session-access.js";
import { resolveWorkspaceIdForUser } from "./workspaces.js";

export const shareToggleBody = z.object({
  sessionId: z.string().uuid(),
  enabled: z.boolean(),
  expiresInDays: z.number().int().min(1).max(90).optional(),
});

export const shareCloneBody = z.object({
  token: z.string().min(16).max(128),
  title: z.string().min(1).max(100).optional(),
  workspaceId: z.string().uuid().optional(),
});

export function toggleStoryCanvasShare(
  userId: string,
  body: z.infer<typeof shareToggleBody>,
) {
  if (!body.enabled) {
    revokeSessionShare(userId, body.sessionId);
    return { enabled: false, ...getSessionShareStatus(userId, body.sessionId) };
  }
  const link = createSessionShareLink(userId, body.sessionId, {
    expiresInDays: body.expiresInDays,
  });
  return {
    enabled: true,
    shareUrl: link.shareUrl,
    expiresAt: link.expiresAt,
    sessionId: body.sessionId,
  };
}

export function viewStoryCanvasShare(token: string) {
  const shared = resolvePublicShare(token);
  return {
    sessionId: shared.sessionId,
    title: shared.title,
    kind: shared.kind,
    updatedAt: shared.updatedAt,
    expiresAt: shared.expiresAt,
    canvasLayout: shared.canvasLayout,
    messageCount: shared.messages.length,
  };
}

export function cloneStoryCanvasShare(
  userId: string,
  body: z.infer<typeof shareCloneBody>,
) {
  const shared = resolvePublicShare(body.token.trim());
  const newId = randomUUID();
  const title = body.title?.trim() || `${shared.title}（副本）`.slice(0, 100);
  const workspaceId = resolveWorkspaceIdForUser(userId, body.workspaceId);

  db.prepare(
    `INSERT INTO image_sessions (id, user_id, workspace_id, title, mode, kind, canvas_layout)
     VALUES (?, ?, ?, ?, 'chat', 'canvas', ?)`,
  ).run(
    newId,
    userId,
    workspaceId,
    title,
    shared.canvasLayout ? serializeCanvasLayout(shared.canvasLayout) : null,
  );

  const session = db
    .prepare(
      `SELECT id, user_id, workspace_id, title, mode, kind, status, created_at, updated_at
       FROM image_sessions WHERE id = ?`,
    )
    .get(newId) as Parameters<typeof mapSessionForUser>[0] | undefined;

  if (!session) {
    throw new AppError(500, "INTERNAL_ERROR", "克隆工作流失败");
  }

  return {
    sessionId: newId,
    session: mapSessionForUser(session, userId),
    sourceSessionId: shared.sessionId,
  };
}

export function getStoryCanvasShareStatus(userId: string, sessionId: string) {
  assertSessionWrite(userId, sessionId);
  return getSessionShareStatus(userId, sessionId);
}
