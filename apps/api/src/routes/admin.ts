import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/index.js";
import { getProviderStatus } from "../providers/registry.js";
import { requireAdmin } from "../middleware/admin.js";
import { getModerationStatus } from "../lib/moderation/index.js";
import { getRateLimitStatus } from "../lib/rate-limit.js";
import { getStorageStatus } from "../lib/object-storage/index.js";
import { sqlAnalyticsSinceDays, sqlNow } from "../db/dialect.js";

export const admin = new Hono();

admin.use("*", requireAdmin);

admin.get("/stats", (c) => {
  const users = db
    .prepare("SELECT COUNT(*) as c FROM users")
    .get() as { c: number };
  const jobs = db
    .prepare("SELECT COUNT(*) as c FROM generation_jobs")
    .get() as { c: number };
  const orders = db
    .prepare(
      "SELECT COUNT(*) as c, COALESCE(SUM(price_cents), 0) as revenue FROM credit_orders WHERE status = 'paid'",
    )
    .get() as { c: number; revenue: number };
  const pendingOrders = db
    .prepare("SELECT COUNT(*) as c FROM credit_orders WHERE status = 'pending'")
    .get() as { c: number };
  const credits = db
    .prepare("SELECT COALESCE(SUM(credits), 0) as total FROM users")
    .get() as { total: number };

  return c.json({
    data: {
      userCount: users.c,
      jobCount: jobs.c,
      orderCount: orders.c,
      pendingOrderCount: pendingOrders.c,
      revenueCents: orders.revenue,
      totalCredits: credits.total,
      provider: getProviderStatus(),
      moderation: getModerationStatus(),
      rateLimit: getRateLimitStatus(),
      storage: getStorageStatus(),
      queue: process.env.JOB_QUEUE ?? "memory",
    },
  });
});

admin.get("/analytics", (c) => {
  const days = Math.min(Math.max(Number(c.req.query("days") ?? 7), 1), 30);
  const sinceSql = sqlAnalyticsSinceDays();
  const byName = db
    .prepare(
      `SELECT name, COUNT(*) as count
       FROM analytics_events
       WHERE ${sinceSql}
       GROUP BY name
       ORDER BY count DESC`,
    )
    .all(days) as { name: string; count: number }[];

  const total = db
    .prepare(
      `SELECT COUNT(*) as c FROM analytics_events
       WHERE ${sinceSql}`,
    )
    .get(days) as { c: number };

  const recent = db
    .prepare(
      `SELECT id, name, user_id, props_json, created_at
       FROM analytics_events
       ORDER BY created_at DESC LIMIT 30`,
    )
    .all();

  return c.json({
    data: {
      days,
      total: total.c,
      byName,
      recent,
    },
  });
});

admin.get("/users", (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 100);
  const rows = db
    .prepare(
      `SELECT id, email, credits, created_at FROM users ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit);
  return c.json({ data: rows });
});

admin.get("/orders", (c) => {
  const rows = db
    .prepare(
      `SELECT o.id, o.credits, o.price_cents, o.status, o.created_at, p.name as package_name, u.email
       FROM credit_orders o
       JOIN credit_packages p ON p.id = o.package_id
       JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC LIMIT 50`,
    )
    .all();
  return c.json({ data: rows });
});

admin.get("/reports", (c) => {
  const status = c.req.query("status") ?? "pending";
  const rows = db
    .prepare(
      `SELECT r.id, r.reason, r.content_url, r.status, r.admin_note, r.created_at,
              r.session_id, r.job_id, u.email as reporter_email
       FROM content_reports r
       JOIN users u ON u.id = r.user_id
       WHERE r.status = ?
       ORDER BY r.created_at DESC LIMIT 50`,
    )
    .all(status);
  return c.json({ data: rows });
});

admin.patch("/reports/:id", async (c) => {
  const id = c.req.param("id");
  const body = z
    .object({
      status: z.enum(["pending", "reviewed", "dismissed"]),
      adminNote: z.string().max(500).optional(),
    })
    .parse(await c.req.json());

  const row = db.prepare("SELECT id FROM content_reports WHERE id = ?").get(id);
  if (!row) {
    return c.json({ error: { code: "NOT_FOUND", message: "举报不存在" } }, 404);
  }

  db.prepare(
    `UPDATE content_reports SET status = ?, admin_note = ?, reviewed_at = ${sqlNow()} WHERE id = ?`,
  ).run(body.status, body.adminNote ?? null, id);

  return c.json({ data: { id, status: body.status } });
});

admin.get("/jobs", (c) => {
  const rows = db
    .prepare(
      `SELECT j.id, j.status, j.model_id, j.points_cost, j.mode, j.created_at, u.email
       FROM generation_jobs j
       JOIN users u ON u.id = j.user_id
       ORDER BY j.created_at DESC LIMIT 50`,
    )
    .all();
  return c.json({ data: rows });
});
