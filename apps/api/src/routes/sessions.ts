import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db/index.js";
import type { AuthVariables } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { listSessionReferences } from "../lib/references.js";
import {
  canvasLayoutSchema,
  parseCanvasLayout,
  serializeCanvasLayout,
} from "../lib/canvas-layout.js";
import { sessionKindSchema } from "../lib/session-kind.js";
import {
  assertSessionRead,
  assertSessionWrite,
  canReadSession,
  getSessionById,
  mapSessionForUser,
} from "../lib/session-access.js";
import { listSessionsForUser } from "../lib/session-list.js";
import { resolveWorkspaceIdForUser } from "../lib/workspaces.js";
import { rowToCanonical } from "../lib/inspiration.js";

const SESSION_SELECT =
  "id, user_id, workspace_id, title, mode, kind, status, created_at, updated_at";

/**
 * 根据 source_inspiration_id 拉对应灵感模板，返回前端 StudioInspirationApply 所需结构。
 * - 即使 inspiration 已下线/删除也返回 null（不抛错），让会话继续可用。
 */
function loadSourceInspirationForSession(sessionId: string) {
  const row = db
    .prepare(
      `SELECT s.source_inspiration_id, s.title AS session_title, t.*
       FROM image_sessions s
       LEFT JOIN inspiration_templates t ON t.id = s.source_inspiration_id
       WHERE s.id = ?`,
    )
    .get(sessionId) as
    | (Record<string, unknown> & {
        source_inspiration_id: string | null;
        session_title: string;
        id?: string;
        status?: string;
      })
    | undefined;
  if (!row || !row.source_inspiration_id || !row.id) return null;
  if (row.status && row.status !== "published") return null;

  const canonical = rowToCanonical(
    row as unknown as Parameters<typeof rowToCanonical>[0],
  );
  return {
    id: canonical.id,
    title: row.session_title || canonical.title,
    prompt: canonical.prompt,
    modelId: canonical.modelId,
    aspectRatio: canonical.aspectRatio,
    resolution: canonical.resolution,
    variables: canonical.variables,
    /** 默认变量值映射，前端进入即可填默认值 */
    variableValues: Object.fromEntries(
      (canonical.variables ?? []).map((v) => [v.key, v.default]),
    ),
    referenceUrls: canonical.referenceAssets.map((a) => a.url),
    coverUrl: canonical.coverUrl,
  };
}

const sessions = new Hono<{ Variables: AuthVariables }>();

function loadSessionRow(sessionId: string) {
  return db
    .prepare(`SELECT ${SESSION_SELECT} FROM image_sessions WHERE id = ?`)
    .get(sessionId) as Parameters<typeof mapSessionForUser>[0] | undefined;
}

sessions.post("/ensure", async (c) => {
  const userId = c.get("userId");
  const body = z
    .object({
      sessionId: z.string().uuid(),
      mode: z.enum(["chat", "quick", "ecommerce"]).default("chat"),
      title: z.string().max(100).optional(),
      kind: sessionKindSchema.default("canvas"),
      workspaceId: z.string().uuid().optional(),
      sourceInspirationId: z.string().min(1).max(80).optional(),
    })
    .parse(await c.req.json());

  const existing = getSessionById(body.sessionId);
  if (existing) {
    if (!canReadSession(userId, existing)) {
      throw new AppError(400, "SESSION_TAKEN", "会话 ID 冲突，请刷新页面");
    }
    return c.json({
      data: {
        ...mapSessionForUser(existing, userId),
        sourceInspiration: loadSourceInspirationForSession(body.sessionId),
      },
    });
  }

  const taken = db
    .prepare("SELECT id FROM image_sessions WHERE id = ?")
    .get(body.sessionId);
  if (taken) {
    throw new AppError(400, "SESSION_TAKEN", "会话 ID 冲突，请刷新页面");
  }

  const title =
    body.title ??
    (body.kind === "project"
      ? "新建项目"
      : body.kind === "canvas"
        ? "新建画布"
        : "未命名");

  const workspaceId = resolveWorkspaceIdForUser(userId, body.workspaceId);
  db.prepare(
    `INSERT INTO image_sessions (id, user_id, workspace_id, title, mode, kind, source_inspiration_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    body.sessionId,
    userId,
    workspaceId,
    title,
    body.mode,
    body.kind,
    body.sourceInspirationId ?? null,
  );

  const session = loadSessionRow(body.sessionId);
  return c.json(
    {
      data: {
        ...mapSessionForUser(session!, userId),
        sourceInspiration: loadSourceInspirationForSession(body.sessionId),
      },
    },
    201,
  );
});

sessions.post("/create", async (c) => {
  const userId = c.get("userId");
  const body = z
    .object({
      mode: z.enum(["chat", "quick", "ecommerce"]).default("chat"),
      title: z.string().max(100).optional(),
      kind: sessionKindSchema.default("canvas"),
      workspaceId: z.string().uuid().optional(),
    })
    .parse(await c.req.json().catch(() => ({})));

  const id = randomUUID();
  const title = body.title ?? "未命名";
  const workspaceId = resolveWorkspaceIdForUser(userId, body.workspaceId);
  db.prepare(
    `INSERT INTO image_sessions (id, user_id, workspace_id, title, mode, kind) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, userId, workspaceId, title, body.mode, body.kind);

  const session = loadSessionRow(id);
  return c.json({ data: mapSessionForUser(session!, userId) }, 201);
});

sessions.get("/list", (c) => {
  const userId = c.get("userId");
  const limit = Math.min(Number(c.req.query("limit") ?? 20), 50);
  const kindRaw = c.req.query("kind");
  const kindParsed = kindRaw ? sessionKindSchema.safeParse(kindRaw) : null;
  if (kindRaw && kindParsed && !kindParsed.success) {
    throw new AppError(400, "VALIDATION_ERROR", "kind 须为 canvas 或 project");
  }
  const kind = kindParsed?.success ? kindParsed.data : undefined;
  const workspaceId = c.req.query("workspaceId");

  const data = listSessionsForUser(userId, {
    limit,
    workspaceId: workspaceId || undefined,
    kind,
  });
  return c.json({ data });
});

sessions.get("/queryImageSessionRequestMode", (c) => {
  const sessionId = c.req.query("sessionId");
  if (!sessionId) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "sessionId required" } },
      400,
    );
  }
  const userId = c.get("userId");
  const session = assertSessionRead(userId, sessionId);
  return c.json({
    data: {
      sessionId,
      id: session.id,
      mode: session.mode,
      status: session.status,
      can_edit: mapSessionForUser(session, userId).can_edit,
    },
  });
});

sessions.patch("/:sessionId", async (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");
  const body = z
    .object({ title: z.string().trim().min(1).max(100) })
    .parse(await c.req.json());

  assertSessionWrite(userId, sessionId);

  db.prepare(
    `UPDATE image_sessions SET title = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(body.title, sessionId);

  const session = loadSessionRow(sessionId);
  return c.json({ data: mapSessionForUser(session!, userId) });
});

sessions.delete("/:sessionId", (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");

  assertSessionWrite(userId, sessionId);

  db.prepare("DELETE FROM image_sessions WHERE id = ?").run(sessionId);

  return c.json({ data: { deleted: true, sessionId } });
});

sessions.get("/:sessionId/canvas", (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");
  assertSessionRead(userId, sessionId);
  const row = db
    .prepare("SELECT canvas_layout FROM image_sessions WHERE id = ?")
    .get(sessionId) as { canvas_layout: string | null } | undefined;
  const layout = parseCanvasLayout(row?.canvas_layout ?? null);
  return c.json({ data: layout ?? { version: 1 as const, items: [] } });
});

sessions.put("/:sessionId/canvas", async (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");
  const body = canvasLayoutSchema.parse(await c.req.json());

  assertSessionWrite(userId, sessionId);

  db.prepare(
    `UPDATE image_sessions SET canvas_layout = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(serializeCanvasLayout(body), sessionId);

  return c.json({ data: body });
});

sessions.get("/:sessionId/references", (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");
  assertSessionRead(userId, sessionId);
  return c.json({ data: listSessionReferences(sessionId) });
});

sessions.get("/:sessionId/messages", (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");
  const session = assertSessionRead(userId, sessionId);
  const access = mapSessionForUser(session, userId);

  const messages = db
    .prepare(
      `SELECT m.id, m.role, m.content, m.job_id, m.created_at,
              j.parent_job_id, j.source_output_id, j.model_id, j.resolution, j.aspect_ratio, j.tool_type, j.prompt, j.count
       FROM messages m
       LEFT JOIN generation_jobs j ON j.id = m.job_id
       WHERE m.session_id = ? ORDER BY m.created_at ASC`,
    )
    .all(sessionId) as {
    id: string;
    role: string;
    content: string;
    job_id: string | null;
    created_at: string;
    parent_job_id: string | null;
    source_output_id: string | null;
    model_id: string | null;
    resolution: string | null;
    aspect_ratio: string | null;
    tool_type: string | null;
    prompt: string | null;
    count: number | null;
  }[];

  const data = messages.map((m) => {
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
      parent_job_id: m.parent_job_id ?? undefined,
      source_output_id: m.source_output_id ?? undefined,
      outputs: outputs.map((o) => ({
        id: o.id,
        url: o.url,
        sort_order: o.sort_order,
        label: o.label ?? undefined,
      })),
      generation_params: m.job_id ? {
        prompt: m.prompt ?? "",
        modelId: m.model_id ?? undefined,
        resolution: m.resolution ?? undefined,
        aspectRatio: m.aspect_ratio ?? undefined,
        toolType: m.tool_type ?? undefined,
        count: m.count ?? undefined,
      } : undefined,
    };
  });

  return c.json({ data, meta: access });
});

sessions.get("/:sessionId/export", (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");
  const session = assertSessionRead(userId, sessionId);

  const assets = db
    .prepare(
      `SELECT mo.url, mo.sort_order, m.created_at, m.role
       FROM message_outputs mo
       JOIN messages m ON m.id = mo.message_id
       WHERE m.session_id = ? AND m.role = 'assistant'
       ORDER BY m.created_at ASC, mo.sort_order ASC`,
    )
    .all(sessionId);

  return c.json({
    data: {
      sessionId,
      title: session.title,
      files: assets,
      count: assets.length,
    },
  });
});

export { sessions };
