import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db/index.js";
import type { AuthVariables } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";

const sessions = new Hono<{ Variables: AuthVariables }>();

sessions.post("/ensure", async (c) => {
  const userId = c.get("userId");
  const body = z
    .object({
      sessionId: z.string().uuid(),
      mode: z.enum(["chat", "quick", "ecommerce"]).default("chat"),
      title: z.string().max(100).optional(),
    })
    .parse(await c.req.json());

  const existing = db
    .prepare(
      "SELECT id, title, mode, status, created_at, updated_at FROM image_sessions WHERE id = ? AND user_id = ?",
    )
    .get(body.sessionId, userId);

  if (existing) {
    return c.json({ data: existing });
  }

  const taken = db
    .prepare("SELECT id FROM image_sessions WHERE id = ?")
    .get(body.sessionId);
  if (taken) {
    throw new AppError(400, "SESSION_TAKEN", "会话 ID 冲突，请刷新页面");
  }

  db.prepare(
    `INSERT INTO image_sessions (id, user_id, title, mode) VALUES (?, ?, ?, ?)`,
  ).run(body.sessionId, userId, body.title ?? "未命名", body.mode);

  const session = db
    .prepare(
      "SELECT id, title, mode, status, created_at, updated_at FROM image_sessions WHERE id = ?",
    )
    .get(body.sessionId);

  return c.json({ data: session }, 201);
});

sessions.post("/create", async (c) => {
  const userId = c.get("userId");
  const body = z
    .object({
      mode: z.enum(["chat", "quick", "ecommerce"]).default("chat"),
      title: z.string().max(100).optional(),
    })
    .parse(await c.req.json().catch(() => ({})));

  const id = randomUUID();
  db.prepare(
    `INSERT INTO image_sessions (id, user_id, title, mode) VALUES (?, ?, ?, ?)`,
  ).run(id, userId, body.title ?? "未命名", body.mode);

  const session = db
    .prepare(
      "SELECT id, title, mode, status, created_at, updated_at FROM image_sessions WHERE id = ?",
    )
    .get(id);

  return c.json({ data: session }, 201);
});

sessions.get("/list", (c) => {
  const userId = c.get("userId");
  const limit = Math.min(Number(c.req.query("limit") ?? 20), 50);
  const rows = db
    .prepare(
      `SELECT id, title, mode, status, updated_at
       FROM image_sessions WHERE user_id = ?
       ORDER BY updated_at DESC LIMIT ?`,
    )
    .all(userId, limit);
  return c.json({ data: rows });
});

sessions.get("/queryImageSessionRequestMode", (c) => {
  const sessionId = c.req.query("sessionId");
  if (!sessionId) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "sessionId required" } }, 400);
  }
  const userId = c.get("userId");
  const row = db
    .prepare("SELECT id, mode, status FROM image_sessions WHERE id = ? AND user_id = ?")
    .get(sessionId, userId);
  if (!row) throw new AppError(404, "NOT_FOUND", "会话不存在");
  return c.json({ data: { sessionId, ...row } });
});

sessions.get("/:sessionId/messages", (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");
  const session = db
    .prepare("SELECT id FROM image_sessions WHERE id = ? AND user_id = ?")
    .get(sessionId, userId);
  if (!session) throw new AppError(404, "NOT_FOUND", "会话不存在");

  const messages = db
    .prepare(
      `SELECT id, role, content, job_id, created_at FROM messages
       WHERE session_id = ? ORDER BY created_at ASC`,
    )
    .all(sessionId) as {
    id: string;
    role: string;
    content: string;
    job_id: string | null;
    created_at: string;
  }[];

  const data = messages.map((m) => {
    const outputs = db
      .prepare(
        `SELECT url, sort_order FROM message_outputs WHERE message_id = ? ORDER BY sort_order`,
      )
      .all(m.id) as { url: string; sort_order: number }[];
    return { ...m, outputs };
  });

  return c.json({ data });
});

export { sessions };
