import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { assertSessionWrite } from "../lib/session-access.js";
import { db } from "../db/index.js";
import {
  createDramaPlanRun,
  serializeDramaPlanRun,
} from "../lib/drama/plan-runs.js";
import { dispatchDramaPlanRun } from "../lib/drama/plan-executor.js";

/**
 * Phase 4 Task 4.3 — 工作流模板保存/复用
 *
 * 挂载在 `/drama/templates` 下，提供：
 * - POST   /           保存模板（用户选中节点组序列化为 JSON）
 * - GET    /           模板列表（预置 + 用户自建）
 * - GET    /:id        模板详情
 * - POST   /:id/run    一键重跑（基于模板的 userIdea/projectType 创建规划 Run）
 */
const dramaTemplates = new Hono<{ Variables: AuthVariables }>();

export interface DramaTemplateRow {
  id: string;
  user_id: string | null;
  name: string;
  category: string;
  description: string | null;
  template_json: string;
  is_preset: number;
  created_at: string;
  updated_at: string;
}

function serializeTemplate(row: DramaTemplateRow) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description ?? undefined,
    template: JSON.parse(row.template_json) as Record<string, unknown>,
    isPreset: row.is_preset === 1,
    userId: row.user_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const createBody = z.object({
  name: z.string().min(1).max(80),
  category: z
    .enum(["short_drama", "mv", "tvc", "custom"])
    .default("custom"),
  description: z.string().max(500).optional(),
  template: z.record(z.unknown()),
});

/** 保存为模板 */
dramaTemplates.post("/", async (c) => {
  const userId = c.get("userId");
  const body = createBody.parse(await c.req.json());
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO drama_templates
     (id, user_id, name, category, description, template_json, is_preset, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
  ).run(
    id,
    userId,
    body.name,
    body.category,
    body.description ?? null,
    JSON.stringify(body.template),
  );
  const row = db
    .prepare(`SELECT * FROM drama_templates WHERE id = ?`)
    .get(id) as DramaTemplateRow | undefined;
  if (!row) throw new AppError(500, "INTERNAL_ERROR", "保存模板失败");
  return c.json({ data: serializeTemplate(row) }, 201);
});

/** 模板列表（预置 + 当前用户自建） */
dramaTemplates.get("/", (c) => {
  const userId = c.get("userId");
  const rows = db
    .prepare(
      `SELECT * FROM drama_templates
       WHERE is_preset = 1 OR user_id = ?
       ORDER BY is_preset DESC, created_at DESC`,
    )
    .all(userId) as unknown as DramaTemplateRow[];
  return c.json({ data: rows.map(serializeTemplate) });
});

/** 模板详情 */
dramaTemplates.get("/:id", (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const row = db
    .prepare(`SELECT * FROM drama_templates WHERE id = ?`)
    .get(id) as DramaTemplateRow | undefined;
  if (!row) throw new AppError(404, "NOT_FOUND", "模板不存在");
  if (row.is_preset !== 1 && row.user_id !== userId) {
    throw new AppError(404, "NOT_FOUND", "模板不存在");
  }
  return c.json({ data: serializeTemplate(row) });
});

const runBody = z.object({
  sessionId: z.string().uuid(),
  autoProduce: z.coerce.boolean().default(false),
  /** 替换素材：覆盖模板的 userIdea */
  userIdeaOverride: z.string().min(10).max(2000).optional(),
});

/** 一键重跑：基于模板创建规划 Run */
dramaTemplates.post("/:id/run", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = runBody.parse(await c.req.json());
  assertSessionWrite(userId, body.sessionId);

  const row = db
    .prepare(`SELECT * FROM drama_templates WHERE id = ?`)
    .get(id) as DramaTemplateRow | undefined;
  if (!row) throw new AppError(404, "NOT_FOUND", "模板不存在");
  if (row.is_preset !== 1 && row.user_id !== userId) {
    throw new AppError(404, "NOT_FOUND", "模板不存在");
  }

  const tpl = JSON.parse(row.template_json) as {
    userIdea?: string;
    projectType?: "short_drama" | "mv" | "creative";
    targetDurationSec?: number;
    aspectRatio?: "9:16" | "16:9";
  };

  const userIdea = body.userIdeaOverride ?? tpl.userIdea;
  if (!userIdea || userIdea.length < 10) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "模板缺少 userIdea，请在重跑时通过 userIdeaOverride 提供",
    );
  }

  const planRun = createDramaPlanRun({
    sessionId: body.sessionId,
    userId,
    userIdea,
    targetDurationSec: tpl.targetDurationSec,
    aspectRatio: tpl.aspectRatio,
    autoProduce: body.autoProduce,
    projectType: tpl.projectType,
  });
  dispatchDramaPlanRun(planRun.id, userId);

  return c.json({ data: serializeDramaPlanRun(planRun) }, 201);
});

/** 删除用户自建模板（预置模板不可删） */
dramaTemplates.delete("/:id", (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const row = db
    .prepare(`SELECT * FROM drama_templates WHERE id = ?`)
    .get(id) as DramaTemplateRow | undefined;
  if (!row) throw new AppError(404, "NOT_FOUND", "模板不存在");
  if (row.is_preset === 1) {
    throw new AppError(400, "INVALID_STATE", "预置模板不可删除");
  }
  if (row.user_id !== userId) {
    throw new AppError(404, "NOT_FOUND", "模板不存在");
  }
  db.prepare(`DELETE FROM drama_templates WHERE id = ?`).run(id);
  return c.json({ data: { ok: true } });
});

export { dramaTemplates };
