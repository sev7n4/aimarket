import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db/index.js";
import { verifyToken } from "../lib/auth.js";

/** Sprint 7：轻量埋点（PRD 最小集） */
export const events = new Hono();

events.post("/", async (c) => {
  const body = z
    .object({
      name: z.string().min(1).max(64),
      props: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
    })
    .parse(await c.req.json());

  let userId: string | undefined;
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      userId = await verifyToken(authHeader.slice(7));
    } catch {
      userId = undefined;
    }
  }
  const id = randomUUID();

  db.prepare(
    `INSERT INTO analytics_events (id, user_id, name, props_json) VALUES (?, ?, ?, ?)`,
  ).run(
    id,
    userId ?? null,
    body.name,
    body.props ? JSON.stringify(body.props) : null,
  );

  return c.json({ data: { ok: true } }, 201);
});
