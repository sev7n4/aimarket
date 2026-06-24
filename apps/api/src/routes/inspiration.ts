import { Hono } from "hono";
import { z } from "zod";
import {
  archiveUserPublishedInspiration,
  createUserPublishedInspiration,
  ensureInspirationRowCover,
  getPublishedInspirationById,
  getPublishedInspirationByLegacyId,
  listPublishedInspirations,
  listUserPublishedInspirations,
  renderInspirationWithVariables,
  rowToCanonical,
  rowToKeywordDetail,
  rowToKeywordListItem,
  dramaTemplateMetadataSchema,
} from "../lib/inspiration.js";
import {
  isSuspectNonPlayableVideoUrl,
  isVideoMediaUrl,
} from "../lib/video-poster.js";
import { forkProjectFromInspiration, copyProductionSessionFromInspiration } from "../lib/inspiration-fork.js";
import { recordAnalyticsEvent } from "../lib/analytics.js";
import { requireAuth, type AuthVariables } from "../middleware/auth.js";

const inspiration = new Hono<{ Variables: AuthVariables }>();

const pageQuery = z.object({
  pageNum: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(30),
  category: z.string().optional(),
  fanSet: z.enum(["apparel"]).optional(),
});

inspiration.get("/page", async (c) => {
  const q = pageQuery.parse({
    pageNum: c.req.query("pageNum"),
    pageSize: c.req.query("pageSize"),
    category: c.req.query("category"),
    fanSet: c.req.query("fanSet"),
  });
  const { total, rows } = listPublishedInspirations(q);
  const hydrated = await Promise.all(
    rows.map(async (row) => {
      if (
        isVideoMediaUrl(row.cover_url) &&
        !isSuspectNonPlayableVideoUrl(row.cover_url)
      ) {
        return ensureInspirationRowCover(row);
      }
      return row;
    }),
  );
  return c.json({
    data: {
      total,
      rows: hydrated.map((row) => {
        const item = rowToCanonical(row);
        return {
          id: item.id,
          title: item.title,
          category: item.category,
          coverUrl: item.coverUrl,
          aspectRatio: item.aspectRatio,
          mediaType: item.mediaType,
          videoUrl: item.videoUrl,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      }),
    },
  });
});

const mineQuery = z.object({
  pageNum: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

/** 须在 /:id 之前注册，避免被当成灵感 ID */
inspiration.get("/mine", requireAuth, (c) => {
  const userId = c.get("userId");
  const q = mineQuery.parse({
    pageNum: c.req.query("pageNum"),
    pageSize: c.req.query("pageSize"),
  });
  const { total, rows } = listUserPublishedInspirations(userId, q);
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
          mediaType: item.mediaType,
          videoUrl: item.videoUrl,
          sourceOutputId: item.sourceOutputId,
          sourceAssetId: item.sourceAssetId,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      }),
    },
  });
});

inspiration.get("/:id", async (c) => {
  const id = c.req.param("id");
  let row = getPublishedInspirationById(id);
  if (
    isVideoMediaUrl(row.cover_url) &&
    !isSuspectNonPlayableVideoUrl(row.cover_url)
  ) {
    row = await ensureInspirationRowCover(row);
  }
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

const publishBody = z
  .object({
    coverUrl: z.string().min(1).optional(),
    prompt: z.string().min(1).max(8000).optional(),
    title: z.string().min(1).max(120).optional(),
    modelId: z.string().min(1).optional(),
    aspectRatio: z.string().min(1).max(16).optional(),
    resolution: z.enum(["1k", "2k", "4k"]).optional(),
    referenceUrls: z.array(z.string().min(1)).max(12).optional(),
    outputId: z.string().min(1).optional(),
    assetId: z.string().min(1).optional(),
    dramaTemplate: dramaTemplateMetadataSchema.optional(),
})
  .superRefine((body, ctx) => {
    if (!body.outputId && !body.assetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "请提供 outputId 或 assetId",
      });
    }
    if (!body.outputId && !body.prompt?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "缺少 outputId 时必须提供 prompt",
      });
    }
    if (!body.outputId && !body.coverUrl?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "缺少 outputId 时必须提供 coverUrl",
      });
    }
  });

inspirationAuthed.post("/publish", async (c) => {
  const userId = c.get("userId");
  const body = publishBody.parse(await c.req.json());
  const data = await createUserPublishedInspiration(userId, body);
  void recordAnalyticsEvent(userId, "inspiration.publish", {
    inspirationId: data.id,
    modelId: data.modelId,
  });
  return c.json({ data }, 201);
});

inspirationAuthed.delete("/:id", (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const data = archiveUserPublishedInspiration(userId, id);
  void recordAnalyticsEvent(userId, "inspiration.unpublish", {
    inspirationId: id,
  });
  return c.json({ data });
});

inspirationAuthed.post("/:id/fork-project", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = z
    .object({
      variables: z.record(z.string(), z.string()).optional(),
      mode: z.enum(["chat", "image", "ecommerce"]).default("image"),
      workspaceId: z.string().uuid().optional(),
    })
    .parse(await c.req.json().catch(() => ({})));

  const result = forkProjectFromInspiration(userId, id, body);
  return c.json({ data: result }, 201);
});

inspirationAuthed.post("/:id/copy-to-session", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = z
    .object({
      workspaceId: z.string().uuid().optional(),
    })
    .parse(await c.req.json().catch(() => ({})));

  const result = copyProductionSessionFromInspiration(userId, id, body);
  void recordAnalyticsEvent(userId, "inspiration.copy_to_session", {
    inspirationId: id,
    sessionId: result.session.id,
    projectType: result.dramaTemplate.projectType,
  });
  return c.json({ data: result }, 201);
});

export { inspiration };
