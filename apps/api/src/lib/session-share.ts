import { createHash, randomBytes, randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { AppError } from "./errors.js";
import { assertSessionRead, assertSessionWrite, mapSessionForUser } from "./session-access.js";
import { parseCanvasLayout } from "./canvas-layout.js";
import { getPublicWebUrl } from "./public-url.js";

const DEFAULT_SHARE_DAYS = 30;

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

function activeShareForSession(sessionId: string) {
  return db
    .prepare(
      `SELECT id, session_id, token_hash, expires_at, revoked_at, created_at
       FROM session_shares
       WHERE session_id = ?
         AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > datetime('now'))
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get(sessionId) as
    | {
        id: string;
        session_id: string;
        token_hash: string;
        expires_at: string | null;
        revoked_at: string | null;
        created_at: string;
      }
    | undefined;
}

export function loadSessionMessagesForShare(sessionId: string) {
  const messages = db
    .prepare(
      `SELECT m.id, m.role, m.content, m.job_id, m.created_at
       FROM messages m
       WHERE m.session_id = ? ORDER BY m.created_at ASC`,
    )
    .all(sessionId) as {
    id: string;
    role: string;
    content: string;
    job_id: string | null;
    created_at: string;
  }[];

  return messages.map((m) => {
    const outputs = db
      .prepare(
        `SELECT id, url, sort_order, label FROM message_outputs WHERE message_id = ? ORDER BY sort_order`,
      )
      .all(m.id) as {
      id: string;
      url: string;
      sort_order: number;
      label: string | null;
    }[];
    return {
      id: m.id,
      role: m.role,
      content: m.content,
      job_id: m.job_id,
      created_at: m.created_at,
      outputs: outputs.map((o) => ({
        id: o.id,
        url: o.url,
        sort_order: o.sort_order,
        label: o.label ?? undefined,
      })),
    };
  });
}

export function createSessionShareLink(
  userId: string,
  sessionId: string,
  options?: { expiresInDays?: number },
) {
  assertSessionWrite(userId, sessionId);
  const session = assertSessionRead(userId, sessionId);

  const existing = activeShareForSession(sessionId);
  if (existing) {
    db.prepare(
      `UPDATE session_shares SET revoked_at = datetime('now') WHERE id = ?`,
    ).run(existing.id);
  }

  const rawToken = randomBytes(24).toString("hex");
  const tokenHash = hashToken(rawToken);
  const days = options?.expiresInDays ?? DEFAULT_SHARE_DAYS;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  const shareId = randomUUID();

  db.prepare(
    `INSERT INTO session_shares (id, session_id, token_hash, created_by, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(shareId, sessionId, tokenHash, userId, expiresAt.toISOString());

  const shareUrl = `${getPublicWebUrl()}/share/${rawToken}`;

  return {
    shareId,
    shareUrl,
    expiresAt: expiresAt.toISOString(),
    session: mapSessionForUser(session, userId),
  };
}

export function getSessionShareStatus(userId: string, sessionId: string) {
  assertSessionRead(userId, sessionId);
  const row = activeShareForSession(sessionId);
  return {
    active: Boolean(row),
    expiresAt: row?.expires_at ?? null,
    createdAt: row?.created_at ?? null,
  };
}

export function revokeSessionShare(userId: string, sessionId: string) {
  assertSessionWrite(userId, sessionId);
  const row = activeShareForSession(sessionId);
  if (!row) {
    throw new AppError(404, "NOT_FOUND", "当前没有有效的分享链接");
  }
  db.prepare(
    `UPDATE session_shares SET revoked_at = datetime('now') WHERE id = ?`,
  ).run(row.id);
  return { revoked: true };
}

export function resolvePublicShare(rawToken: string) {
  const tokenHash = hashToken(rawToken.trim());
  const share = db
    .prepare(
      `SELECT sh.id, sh.session_id, sh.expires_at, sh.revoked_at,
              s.title, s.mode, s.kind, s.status, s.canvas_layout, s.updated_at
       FROM session_shares sh
       JOIN image_sessions s ON s.id = sh.session_id
       WHERE sh.token_hash = ?`,
    )
    .get(tokenHash) as
    | {
        id: string;
        session_id: string;
        expires_at: string | null;
        revoked_at: string | null;
        title: string;
        mode: string;
        kind: string;
        status: string;
        canvas_layout: string | null;
        updated_at: string;
      }
    | undefined;

  if (!share || share.revoked_at) {
    throw new AppError(404, "NOT_FOUND", "分享链接无效或已撤销");
  }
  if (share.expires_at && new Date(share.expires_at).getTime() < Date.now()) {
    throw new AppError(410, "SHARE_EXPIRED", "分享链接已过期");
  }

  const messages = loadSessionMessagesForShare(share.session_id);
  const canvasLayout =
    share.canvas_layout ? parseCanvasLayout(share.canvas_layout) : null;

  return {
    sessionId: share.session_id,
    title: share.title,
    mode: share.mode,
    kind: share.kind,
    status: share.status,
    updatedAt: share.updated_at,
    expiresAt: share.expires_at,
    messages,
    canvasLayout,
  };
}
