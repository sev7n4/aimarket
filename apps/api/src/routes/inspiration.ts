import { Hono } from "hono";
import { z } from "zod";
import {
  getPublishedInspirationById,
  getPublishedInspirationByLegacyId,
  listPublishedInspirations,
  renderInspirationWithVariables,
  rowToCanonical,
  rowToKeywordDetail,
  rowToKeywordListItem,
} from "../lib/inspiration.js";
import { forkProjectFromInspiration } from "../lib/inspiration-fork.js";
import { recordAnalyticsEvent } from "../lib/analytics.js";
import type { AuthVariables } from "../middleware/auth.js";

const inspiration = new Hono();

const pageQuery = z.object({
  pageNum: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(30),
  category: z.string().optional(),
  fanSet: z.enum(["apparel"]).optional(),
});

inspiration.get("/page", (c) => {
  const q = pageQuery.parse({
    pageNum: c.req.query("pageNum"),
    pageSize: c.req.query("pageSize"),
    category: c.req.query("category"),
    fanSet: c.req.query("fanSet"),
  });
  const { total, rows } = listPublishedInspirations(q);
  return c.json({
    data: {
      total,
      rows: rows.map((row) => {
        const item = rowToCanonical(row);
        return {
          id: item.id,
          title: item.title,
          category: item.category,
          coverUrl: item.coverUrl,
          aspectRatio: item.aspectRatio,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      }),
    },
  });
});

inspiration.get("/:id", (c) => {
  const id = c.req.param("id");
  const row = getPublishedInspirationById(id);
  void recordAnalyticsEvent(null, "inspiration.click", {
    inspirationId: row.id,
    source: "canonical",
  });
  return c.json({ data: rowToCanonical(row) });
});

inspiration.post("/:id/render", async (c) => {
  const id = c.req.param("id");
  const body = z
    .object({
      variables: z.record(z.string(), z.string()).optional(),
    })
    .parse(await c.req.json().catch(() => ({})));

  const row = getPublishedInspirationById(id);
  const rendered = renderInspirationWithVariables(row, body.variables);
  return c.json({ data: rendered });
});

/** 椒图兼容：GET /keyword/page */
export const keyword = new Hono();

keyword.get("/page", (c) => {
  const q = pageQuery.parse({
    pageNum: c.req.query("pageNum"),
    pageSize: c.req.query("pageSize"),
    category: c.req.query("category"),
  });
  const { total, rows } = listPublishedInspirations(q);
  return c.json({
    data: {
      total,
      rows: rows.map(rowToKeywordListItem),
    },
  });
});

keyword.get("/detail/:id", (c) => {
  const legacyId = Number(c.req.param("id"));
  if (!Number.isFinite(legacyId)) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "无效的灵感 ID" } },
      400,
    );
  }
  const row = getPublishedInspirationByLegacyId(legacyId);
  void recordAnalyticsEvent(null, "inspiration.click", {
    legacyId,
    inspirationId: row.id,
    source: "keyword",
  });
  return c.json({ data: rowToKeywordDetail(row) });
});

export const inspirationAuthed = new Hono<{ Variables: AuthVariables }>();

inspirationAuthed.post("/:id/fork-project", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = z
    .object({
      variables: z.record(z.string(), z.string()).optional(),
      mode: z.enum(["chat", "quick", "ecommerce"]).default("chat"),
      workspaceId: z.string().uuid().optional(),
    })
    .parse(await c.req.json().catch(() => ({})));

  const result = forkProjectFromInspiration(userId, id, body);
  return c.json({ data: result }, 201);
});

export { inspiration };
