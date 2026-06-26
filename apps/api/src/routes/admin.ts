import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/index.js";
import { getProviderStatus } from "../providers/registry.js";
import { requireAdmin } from "../middleware/admin.js";
import { getModerationStatus } from "../lib/moderation/index.js";
import { getRateLimitStatus } from "../lib/rate-limit.js";
import { getStorageStatus } from "../lib/object-storage/index.js";
import { sqlAnalyticsSinceDays, sqlNow } from "../db/dialect.js";
import { randomUUID } from "node:crypto";
import {
  archiveInspirationById,
  assertValidModelId,
  rowToCanonical,
  inspirationVariableSchema,
  type InspirationRow,
} from "../lib/inspiration.js";
import { AppError } from "../lib/errors.js";
import {
  agnesVideoConfigured,
  probeAgnesVideoTask,
} from "../providers/video/agnes.js";
import { createOpenApiKey } from "../lib/open-api-keys.js";
import { getVideoProviderStatus } from "../providers/video/registry.js";
import { marketplaceAdmin } from "./marketplace.js";

export const admin = new Hono();

admin.use("*", requireAdmin);
admin.route("/marketplace", marketplaceAdmin);

admin.get("/agnes/videos/:taskId", async (c) => {
  if (!agnesVideoConfigured()) {
    throw new AppError(503, "AGNES_NOT_CONFIGURED", "AGNES_API_KEY 未配置");
  }
  const taskId = c.req.param("taskId");
  const snap = await probeAgnesVideoTask(taskId);
  return c.json({
    data: {
      ...snap,
      provider: getVideoProviderStatus(),
    },
  });
});

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

const inspirationBody = z.object({
  id: z.string().min(1).max(64).optional(),
  title: z.string().min(1).max(120),
  category: z.string().min(1).max(32),
  promptTemplate: z.string().min(1).max(8000),
  variables: z.array(inspirationVariableSchema).optional(),
  modelId: z.string().min(1),
  aspectRatio: z.string().min(1).max(16).default("auto"),
  resolution: z.enum(["1k", "2k", "4k"]).default("1k"),
  coverUrl: z.string().url(),
  referenceAssets: z
    .array(
      z.object({
        url: z.string().url(),
        fileName: z.string().optional(),
        assetId: z.string().optional(),
      }),
    )
    .max(12)
    .optional(),
  referenceUrls: z
    .array(z.string().url())
    .max(12)
    .optional(),
  status: z.enum(["draft", "published"]).default("published"),
  sortOrder: z.number().int().optional(),
  legacyId: z.number().int().positive().optional(),
});

function resolveReferenceAssets(
  body: {
    coverUrl?: string;
    referenceAssets?: Array<{ url: string; fileName?: string; assetId?: string }>;
    referenceUrls?: string[];
  },
  fallbackCoverUrl: string,
) {
  const fromAssets =
    body.referenceAssets?.map((item) => ({
      url: item.url,
      fileName: item.fileName,
      assetId: item.assetId,
    })) ?? [];
  const fromUrls =
    body.referenceUrls?.map((url) => ({
      url,
    })) ?? [];
  const merged = [...fromAssets, ...fromUrls];
  const uniqueByUrl = Array.from(
    new Map(merged.map((item) => [item.url, item])).values(),
  );
  if (uniqueByUrl.length > 0) return uniqueByUrl;
  return [{ url: body.coverUrl ?? fallbackCoverUrl }];
}

admin.get("/inspiration", (c) => {
  const rows = db
    .prepare(
      `SELECT * FROM inspiration_templates ORDER BY sort_order ASC, legacy_id ASC LIMIT 100`,
    )
    .all();
  return c.json({
    data: rows.map((row) => rowToCanonical(row as unknown as InspirationRow)),
  });
});

admin.post("/inspiration", async (c) => {
  const body = inspirationBody.parse(await c.req.json());
  assertValidModelId(body.modelId);

  const id = body.id ?? randomUUID();
  const exists = db
    .prepare("SELECT id FROM inspiration_templates WHERE id = ?")
    .get(id);
  if (exists) {
    throw new AppError(409, "CONFLICT", "灵感 ID 已存在");
  }

  const maxLegacy = db
    .prepare("SELECT COALESCE(MAX(legacy_id), 0) as m FROM inspiration_templates")
    .get() as { m: number };
  const legacyId = body.legacyId ?? maxLegacy.m + 1;

  const refs = JSON.stringify(resolveReferenceAssets(body, body.coverUrl));

  db.prepare(
    `INSERT INTO inspiration_templates (
      id, legacy_id, title, category, prompt_template, variables_json,
      model_id, aspect_ratio, resolution, cover_url, reference_assets_json,
      status, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    legacyId,
    body.title,
    body.category,
    body.promptTemplate,
    body.variables?.length ? JSON.stringify(body.variables) : null,
    body.modelId,
    body.aspectRatio,
    body.resolution,
    body.coverUrl,
    refs,
    body.status,
    body.sortOrder ?? legacyId,
  );

  const row = db
    .prepare("SELECT * FROM inspiration_templates WHERE id = ?")
    .get(id);
  return c.json(
    { data: rowToCanonical(row as unknown as InspirationRow) },
    201,
  );
});

admin.put("/inspiration/:id", async (c) => {
  const id = c.req.param("id");
  const existing = db
    .prepare("SELECT id FROM inspiration_templates WHERE id = ?")
    .get(id);
  if (!existing) {
    throw new AppError(404, "NOT_FOUND", "灵感不存在");
  }

  const body = inspirationBody.partial().parse(await c.req.json());
  if (body.modelId) assertValidModelId(body.modelId);

  const current = db
    .prepare("SELECT * FROM inspiration_templates WHERE id = ?")
    .get(id) as unknown as InspirationRow;

  const refs =
    body.referenceAssets !== undefined || body.referenceUrls !== undefined ?
      JSON.stringify(
        resolveReferenceAssets(
          {
            coverUrl: body.coverUrl,
            referenceAssets: body.referenceAssets,
            referenceUrls: body.referenceUrls,
          },
          current.cover_url,
        ),
      )
    : current.reference_assets_json;

  db.prepare(
    `UPDATE inspiration_templates SET
      title = ?, category = ?, prompt_template = ?, variables_json = ?,
      model_id = ?, aspect_ratio = ?, resolution = ?, cover_url = ?,
      reference_assets_json = ?, status = ?, sort_order = ?,
      updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    body.title ?? current.title,
    body.category ?? current.category,
    body.promptTemplate ?? current.prompt_template,
    body.variables !== undefined ?
      body.variables.length ?
        JSON.stringify(body.variables)
      : null
    : current.variables_json,
    body.modelId ?? current.model_id,
    body.aspectRatio ?? current.aspect_ratio,
    body.resolution ?? current.resolution,
    body.coverUrl ?? current.cover_url,
    refs,
    body.status ?? current.status,
    body.sortOrder ?? current.sort_order,
    id,
  );

  const row = db
    .prepare("SELECT * FROM inspiration_templates WHERE id = ?")
    .get(id);
  return c.json({
    data: rowToCanonical(row as unknown as InspirationRow),
  });
});

admin.delete("/inspiration/:id", (c) => {
  const id = c.req.param("id");
  const data = archiveInspirationById(id);
  return c.json({ data });
});

/** 为用户签发 OpenAPI Key（仅创建时返回完整 key） */
admin.post("/open-api-keys", async (c) => {
  const body = z
    .object({
      userId: z.string().uuid(),
      name: z.string().trim().min(1).max(80).optional(),
    })
    .parse(await c.req.json());
  const user = db
    .prepare("SELECT id FROM users WHERE id = ?")
    .get(body.userId) as { id: string } | undefined;
  if (!user) {
    throw new AppError(404, "NOT_FOUND", "用户不存在");
  }
  const created = createOpenApiKey(body.userId, body.name ?? "admin-issued");
  return c.json({ data: created }, 201);
});
