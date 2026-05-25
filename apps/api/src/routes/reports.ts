import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db/index.js";
import type { AuthVariables } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";

export const reports = new Hono<{ Variables: AuthVariables }>();

reports.post("/", async (c) => {
  const userId = c.get("userId");
  const body = z
    .object({
      sessionId: z.string().uuid().optional(),
      jobId: z.string().uuid().optional(),
      reason: z.string().min(5).max(500),
      contentUrl: z.string().max(2000).optional(),
    })
    .parse(await c.req.json());

  if (!body.sessionId && !body.jobId) {
    throw new AppError(400, "VALIDATION_ERROR", "请提供 sessionId 或 jobId");
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO content_reports (id, user_id, session_id, job_id, reason, content_url, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
  ).run(
    id,
    userId,
    body.sessionId ?? null,
    body.jobId ?? null,
    body.reason,
    body.contentUrl ?? null,
  );

  return c.json({ data: { id, status: "pending" } }, 201);
});
