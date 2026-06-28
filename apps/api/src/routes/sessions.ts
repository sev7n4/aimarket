import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db/index.js";
import type { AuthVariables } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import {
  extractPublishablePrompt,
  listSessionReferences,
} from "../lib/references.js";
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
import { rowToCanonical, parseDramaTemplateMetadata } from "../lib/inspiration.js";
import {
  createSessionShareLink,
  getSessionShareStatus,
  revokeSessionShare,
} from "../lib/session-share.js";

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
  const dramaTemplate = parseDramaTemplateMetadata(
    (row as { drama_template_json?: string | null }).drama_template_json,
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
    mediaType: canonical.mediaType,
    dramaTemplate,
  };
}

const sessions = new Hono<{ Variables: AuthVariables }>();
const sessionModeSchema = z.enum(["chat", "image", "ecommerce", "production"]);

function loadSessionRow(sessionId: string) {
  return db
    .prepare(`SELECT ${SESSION_SELECT} FROM image_sessions WHERE id = ?`)
    .get(sessionId) as Parameters<typeof mapSessionForUser>[0] | undefined;
}

type SessionMessageRow = {
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
  image_provider: string | null;
  source_lane: string | null;
  tool_context: string | null;
};

function readJobRoutingContext(toolContext: string | null | undefined): {
  autoRoute: boolean;
  routingMode?: "auto" | "explicit" | "byok";
  qualityTier?: "standard" | "pro";
} {
  if (!toolContext) return { autoRoute: false };
  try {
    const parsed = JSON.parse(toolContext) as {
      autoRoute?: boolean;
      routingMode?: "auto" | "explicit" | "byok";
      qualityTier?: "standard" | "pro";
    };
    return {
      autoRoute: parsed.autoRoute === true,
      routingMode: parsed.routingMode,
      qualityTier: parsed.qualityTier,
    };
  } catch {
    return { autoRoute: false };
  }
}

type MessageOutputRow = {
  id: string;
  message_id: string;
  url: string;
  thumb_url: string | null;
  sort_order: number;
  label: string | null;
};

function loadSessionMessages(sessionId: string) {
  const messages = db
    .prepare(
      `SELECT m.id, m.role, m.content, m.job_id, m.created_at,
              j.parent_job_id, j.source_output_id, j.model_id, j.resolution, j.aspect_ratio, j.tool_type, j.prompt, j.count, j.image_provider, j.source_lane, j.tool_context
       FROM messages m
       LEFT JOIN generation_jobs j ON j.id = m.job_id
       WHERE m.session_id = ? ORDER BY m.created_at ASC`,
    )
    .all(sessionId) as SessionMessageRow[];

  if (messages.length === 0) return [];

  const placeholders = messages.map(() => "?").join(",");
  const outputRows = db
    .prepare(
      `SELECT id, message_id, url, thumb_url, sort_order, label
       FROM message_outputs
       WHERE message_id IN (${placeholders})
       ORDER BY message_id, sort_order`,
    )
    .all(...messages.map((m) => m.id)) as MessageOutputRow[];

  const outputsByMessage = new Map<string, MessageOutputRow[]>();
  for (const output of outputRows) {
    const list = outputsByMessage.get(output.message_id) ?? [];
    list.push(output);
    outputsByMessage.set(output.message_id, list);
  }

  return messages.map((m) => {
    const outputs = outputsByMessage.get(m.id) ?? [];
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
        thumbUrl: o.thumb_url ?? o.url,
        sort_order: o.sort_order,
        label: o.label ?? undefined,
      })),
      generation_params: m.job_id
        ? (() => {
            const routing = readJobRoutingContext(m.tool_context);
            return {
              prompt: extractPublishablePrompt(m.prompt ?? "").prompt,
              modelId: m.model_id ?? undefined,
              resolution: m.resolution ?? undefined,
              aspectRatio: m.aspect_ratio ?? undefined,
              toolType: m.tool_type ?? undefined,
              count: m.count ?? undefined,
              imageProvider: m.image_provider ?? undefined,
              autoRoute: routing.autoRoute,
              routingMode: routing.routingMode,
              qualityTier: routing.qualityTier,
              sourceLane: m.source_lane ?? undefined,
            };
          })()
        : undefined,
    };
  });
}

sessions.post("/ensure", async (c) => {
  const userId = c.get("userId");
  const body = z
    .object({
      sessionId: z.string().uuid(),
      mode: sessionModeSchema.default("image"),
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
      mode: sessionModeSchema.default("image"),
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
  const limit = Math.min(Number(c.req.query("limit") ?? 20), 200);
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

sessions.get("/:sessionId", (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");
  const session = assertSessionRead(userId, sessionId);
  return c.json({
    data: {
      ...mapSessionForUser(session, userId),
      sourceInspiration: loadSourceInspirationForSession(sessionId),
    },
  });
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

sessions.get("/:sessionId/canvas-bundle", (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");
  const session = assertSessionRead(userId, sessionId);
  const access = mapSessionForUser(session, userId);
  const row = db
    .prepare("SELECT canvas_layout FROM image_sessions WHERE id = ?")
    .get(sessionId) as { canvas_layout: string | null } | undefined;
  const layout = parseCanvasLayout(row?.canvas_layout ?? null) ?? {
    version: 1 as const,
    items: [],
  };

  return c.json({
    data: {
      layout,
      messages: loadSessionMessages(sessionId),
      meta: access,
    },
  });
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
  const data = loadSessionMessages(sessionId);

  return c.json({ data, meta: access });
});

sessions.get("/:sessionId/share", (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");
  const status = getSessionShareStatus(userId, sessionId);
  return c.json({ data: status });
});

sessions.post("/:sessionId/share", async (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");
  const body = z
    .object({ expiresInDays: z.number().int().min(1).max(90).optional() })
    .parse(await c.req.json().catch(() => ({})));
  const data = createSessionShareLink(userId, sessionId, {
    expiresInDays: body.expiresInDays,
  });
  return c.json({ data }, 201);
});

sessions.delete("/:sessionId/share", (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");
  const data = revokeSessionShare(userId, sessionId);
  return c.json({ data });
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

// ─── 1.2 画布节点式 Flow CRUD API ─────────────────────────────
// 操作 image_sessions.canvas_flow JSON 字段

const canvasFlowNodeSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(["script", "image", "video", "audio", "text"]),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.object({
    type: z.enum(["script", "image", "video", "audio", "text"]),
    label: z.string().max(100),
    assetId: z.string().uuid().optional(),
    outputId: z.string().uuid().optional(),
    prompt: z.string().max(4000).optional(),
    params: z.record(z.unknown()).optional(),
  }),
});

const canvasFlowEdgeSchema = z.object({
  id: z.string().min(1).max(80),
  source: z.string().min(1).max(80),
  target: z.string().min(1).max(80),
  sourceHandle: z.string().max(40).optional(),
  targetHandle: z.string().max(40).optional(),
});

const canvasFlowSchema = z.object({
  nodes: z.array(canvasFlowNodeSchema),
  edges: z.array(canvasFlowEdgeSchema),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).optional(),
});

type CanvasFlowRow = { canvas_flow: string | null };

// 画布流内部结构类型（用于 CRUD 操作的中间态）
type CanvasFlowNodeRow = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
};

type CanvasFlowEdgeRow = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
};

type CanvasFlowData = {
  nodes: CanvasFlowNodeRow[];
  edges: CanvasFlowEdgeRow[];
  viewport?: { x: number; y: number; zoom: number };
};

function loadCanvasFlow(sessionId: string): CanvasFlowData {
  const row = db
    .prepare("SELECT canvas_flow FROM image_sessions WHERE id = ?")
    .get(sessionId) as CanvasFlowRow | undefined;
  if (!row?.canvas_flow) return { nodes: [], edges: [] };
  try {
    return JSON.parse(row.canvas_flow) as CanvasFlowData;
  } catch {
    return { nodes: [], edges: [] };
  }
}

function saveCanvasFlow(sessionId: string, flow: unknown): void {
  db.prepare(
    `UPDATE image_sessions SET canvas_flow = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(JSON.stringify(flow), sessionId);
}

/** POST /sessions/:id/canvas/nodes — 创建节点 */
sessions.post("/:sessionId/canvas/nodes", async (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");
  assertSessionWrite(userId, sessionId);

  const body = z.object({
    type: z.enum(["script", "image", "video", "audio", "text"]),
    position: z.object({ x: z.number(), y: z.number() }),
    label: z.string().max(100).optional(),
    assetId: z.string().uuid().optional(),
  }).parse(await c.req.json());

  const flow = loadCanvasFlow(sessionId);
  const nodeId = randomUUID();
  const node = {
    id: nodeId,
    type: body.type,
    position: body.position,
    data: {
      type: body.type,
      label: body.label ?? (body.type === "script" ? "脚本" : body.type === "image" ? "图片" : body.type === "video" ? "视频" : body.type === "audio" ? "音频" : "文本"),
      assetId: body.assetId,
    },
  };
  flow.nodes.push(node);
  saveCanvasFlow(sessionId, flow);

  return c.json({ data: node }, 201);
});

/** PATCH /sessions/:id/canvas/nodes/:nodeId — 更新节点 */
sessions.patch("/:sessionId/canvas/nodes/:nodeId", async (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");
  const nodeId = c.req.param("nodeId");
  assertSessionWrite(userId, sessionId);

  const body = z.object({
    position: z.object({ x: z.number(), y: z.number() }).optional(),
    label: z.string().max(100).optional(),
    params: z.record(z.unknown()).optional(),
  }).parse(await c.req.json());

  const flow = loadCanvasFlow(sessionId);
  const nodeIndex = flow.nodes.findIndex((n) => n.id === nodeId);
  if (nodeIndex === -1) {
    throw new AppError(404, "NOT_FOUND", "节点不存在");
  }
  const node = flow.nodes[nodeIndex];
  const data = node.data as Record<string, unknown>;
  if (body.position) node.position = body.position;
  if (body.label !== undefined) data.label = body.label;
  if (body.params !== undefined) data.params = body.params;
  node.data = data;
  flow.nodes[nodeIndex] = node;
  saveCanvasFlow(sessionId, flow);

  return c.json({ data: node });
});

/** DELETE /sessions/:id/canvas/nodes/:nodeId — 删除节点及关联边 */
sessions.delete("/:sessionId/canvas/nodes/:nodeId", (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");
  const nodeId = c.req.param("nodeId");
  assertSessionWrite(userId, sessionId);

  const flow = loadCanvasFlow(sessionId);
  const nodeIndex = flow.nodes.findIndex((n) => n.id === nodeId);
  if (nodeIndex === -1) {
    throw new AppError(404, "NOT_FOUND", "节点不存在");
  }
  // 删除关联边
  flow.edges = flow.edges.filter(
    (e) => e.source !== nodeId && e.target !== nodeId,
  );
  // 删除节点
  flow.nodes.splice(nodeIndex, 1);
  saveCanvasFlow(sessionId, flow);

  return c.json({ data: { deleted: true, nodeId } });
});

/** POST /sessions/:id/canvas/edges — 创建边 */
sessions.post("/:sessionId/canvas/edges", async (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");
  assertSessionWrite(userId, sessionId);

  const body = z.object({
    source: z.string().min(1).max(80),
    target: z.string().min(1).max(80),
    sourceHandle: z.string().max(40).optional(),
    targetHandle: z.string().max(40).optional(),
  }).parse(await c.req.json());

  const flow = loadCanvasFlow(sessionId);
  const edgeId = randomUUID();
  const edge = {
    id: edgeId,
    source: body.source,
    target: body.target,
    sourceHandle: body.sourceHandle,
    targetHandle: body.targetHandle,
  };
  flow.edges.push(edge);
  saveCanvasFlow(sessionId, flow);

  return c.json({ data: edge }, 201);
});

/** DELETE /sessions/:id/canvas/edges/:edgeId — 删除边 */
sessions.delete("/:sessionId/canvas/edges/:edgeId", (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");
  const edgeId = c.req.param("edgeId");
  assertSessionWrite(userId, sessionId);

  const flow = loadCanvasFlow(sessionId);
  const edgeIndex = flow.edges.findIndex((e) => e.id === edgeId);
  if (edgeIndex === -1) {
    throw new AppError(404, "NOT_FOUND", "边不存在");
  }
  flow.edges.splice(edgeIndex, 1);
  saveCanvasFlow(sessionId, flow);

  return c.json({ data: { deleted: true, edgeId } });
});

/** GET /sessions/:id/canvas-flow — 读取完整画布流 */
sessions.get("/:sessionId/canvas-flow", (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");
  assertSessionRead(userId, sessionId);
  const flow = loadCanvasFlow(sessionId);
  return c.json({ data: flow });
});

/** PUT /sessions/:id/canvas-flow — 整体覆盖画布流 */
sessions.put("/:sessionId/canvas-flow", async (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");
  assertSessionWrite(userId, sessionId);

  const body = canvasFlowSchema.parse(await c.req.json());
  saveCanvasFlow(sessionId, body);

  return c.json({ data: body });
});

// ─── 12.2 画布模板 CRUD API ─────────────────────────────
// 模板存储在 session 的 canvas_flow JSON 中的 templates 字段

/** 模板节点 */
const templateNodeSchema = z.object({
  type: z.enum(["script", "image", "video", "audio", "text"]),
  label: z.string().max(100),
  params: z.record(z.unknown()).optional(),
});

/** 模板边（使用节点索引） */
const templateEdgeSchema = z.object({
  sourceIndex: z.number().int().min(0),
  targetIndex: z.number().int().min(0),
  sourceHandle: z.string().max(40).optional(),
  targetHandle: z.string().max(40).optional(),
});

/** 模板完整 schema */
const canvasTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(""),
  nodes: z.array(templateNodeSchema).min(1),
  edges: z.array(templateEdgeSchema),
  createdAt: z.string(),
});

type CanvasTemplateRow = z.infer<typeof canvasTemplateSchema>;

/** 从 canvas_flow 中读取 templates 数组 */
function loadTemplates(sessionId: string): CanvasTemplateRow[] {
  const flow = loadCanvasFlow(sessionId) as CanvasFlowData & {
    templates?: CanvasTemplateRow[];
  };
  return flow.templates ?? [];
}

/** 将 templates 保存到 canvas_flow */
function saveTemplates(
  sessionId: string,
  templates: CanvasTemplateRow[],
): void {
  const flow = loadCanvasFlow(sessionId) as CanvasFlowData & {
    templates?: CanvasTemplateRow[];
  };
  flow.templates = templates;
  saveCanvasFlow(sessionId, flow);
}

/** POST /sessions/:id/templates — 保存模板 */
sessions.post("/:sessionId/templates", async (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");
  assertSessionWrite(userId, sessionId);

  const body = canvasTemplateSchema.parse(await c.req.json());
  const templates = loadTemplates(sessionId);
  templates.push(body);
  saveTemplates(sessionId, templates);

  return c.json({ data: body }, 201);
});

/** GET /sessions/:id/templates — 列表模板 */
sessions.get("/:sessionId/templates", (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");
  assertSessionRead(userId, sessionId);

  const templates = loadTemplates(sessionId);
  return c.json({ data: templates });
});

/** DELETE /sessions/:id/templates/:templateId — 删除模板 */
sessions.delete("/:sessionId/templates/:templateId", (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");
  const templateId = c.req.param("templateId");
  assertSessionWrite(userId, sessionId);

  const templates = loadTemplates(sessionId);
  const index = templates.findIndex((t) => t.id === templateId);
  if (index === -1) {
    throw new AppError(404, "NOT_FOUND", "模板不存在");
  }
  templates.splice(index, 1);
  saveTemplates(sessionId, templates);

  return c.json({ data: { deleted: true, templateId } });
});

export { sessions };
