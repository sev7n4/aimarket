import { Hono } from "hono";
import type { AuthVariables } from "../middleware/auth.js";
import { db } from "../db/index.js";

export const noticePublic = new Hono();

noticePublic.get("/latestNotice", (c) => {
  const row = db
    .prepare(
      `SELECT id, title, content, link_label, link_path, created_at
       FROM notices WHERE active = 1
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get();
  return c.json({ data: row ?? null });
});

export const noticeAuthed = new Hono<{ Variables: AuthVariables }>();

noticeAuthed.get("/getRemind", (c) => {
  const userId = c.get("userId");
  const notices = db
    .prepare(
      `SELECT n.id, n.title, n.content, n.link_label, n.link_path
       FROM notices n
       WHERE n.active = 1
       AND n.id NOT IN (
         SELECT notice_id FROM user_notice_reads WHERE user_id = ?
       )
       ORDER BY n.created_at DESC LIMIT 5`,
    )
    .all(userId);

  return c.json({ data: notices });
});

noticeAuthed.post("/:noticeId/dismiss", (c) => {
  const userId = c.get("userId");
  const noticeId = c.req.param("noticeId");
  const exists = db.prepare("SELECT id FROM notices WHERE id = ?").get(noticeId);
  if (!exists) return c.json({ data: { ok: true } });

  db.prepare(
    `INSERT OR IGNORE INTO user_notice_reads (user_id, notice_id) VALUES (?, ?)`,
  ).run(userId, noticeId);

  return c.json({ data: { ok: true } });
});
