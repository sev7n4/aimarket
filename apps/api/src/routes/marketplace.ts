import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import {
  createMarketplaceSkill,
  getMarketplaceSkill,
  listMyMarketplaceSkills,
  listPendingMarketplaceSkills,
  listPublishedMarketplaceSkills,
  publishMarketplaceSkill,
  rejectMarketplaceSkill,
} from "../lib/marketplace.js";

/** 公开路由 — 浏览已发布 Skill（无需认证） */
export const marketplace = new Hono();

marketplace.get("/skills", (c) => {
  const pageNum = Number(c.req.query("pageNum") ?? "1");
  const pageSize = Number(c.req.query("pageSize") ?? "20");
  const category = c.req.query("category") || undefined;
  const { items, total } = listPublishedMarketplaceSkills({ pageNum, pageSize, category });
  return c.json({ data: items, total, pageNum, pageSize });
});

marketplace.get("/skills/:slug", (c) => {
  const slug = c.req.param("slug");
  const skill = getMarketplaceSkill(slug);
  if (!skill || skill.status !== "published") {
    throw new AppError(404, "NOT_FOUND", "Skill 不存在或未发布");
  }
  return c.json({ data: skill });
});

marketplace.get("/skills/:slug/yaml", (c) => {
  const slug = c.req.param("slug");
  const skill = getMarketplaceSkill(slug);
  if (!skill || skill.status !== "published") {
    throw new AppError(404, "NOT_FOUND", "Skill 不存在或未发布");
  }
  return c.text(skill.skillYaml, 200, { "Content-Type": "text/yaml" });
});

/** 认证路由 — 上架 / 管理自己的 Skill */
export const marketplaceAuthed = new Hono<{ Variables: AuthVariables }>();

const submitBody = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  category: z.string().max(40).optional(),
  skillYaml: z.string().min(10).max(20000),
});

marketplaceAuthed.get("/my/skills", (c) => {
  const userId = c.get("userId");
  const items = listMyMarketplaceSkills(userId);
  return c.json({ data: items });
});

marketplaceAuthed.post("/skills", async (c) => {
  const userId = c.get("userId");
  const body = submitBody.parse(await c.req.json());
  const skill = createMarketplaceSkill({
    authorId: userId,
    name: body.name,
    description: body.description,
    category: body.category,
    skillYaml: body.skillYaml,
  });
  return c.json({ data: skill }, 201);
});

/** Admin 路由 — 审核队列 + 发布/拒绝 */
export const marketplaceAdmin = new Hono();

marketplaceAdmin.get("/skills/pending", (c) => {
  const items = listPendingMarketplaceSkills();
  return c.json({ data: items });
});

const rejectBody = z.object({ reason: z.string().min(1).max(500) });

marketplaceAdmin.post("/skills/:id/publish", (c) => {
  const skillId = c.req.param("id");
  const skill = publishMarketplaceSkill(skillId, null);
  return c.json({ data: skill });
});

marketplaceAdmin.post("/skills/:id/reject", async (c) => {
  const skillId = c.req.param("id");
  const body = rejectBody.parse(await c.req.json());
  const skill = rejectMarketplaceSkill(skillId, null, body.reason);
  return c.json({ data: skill });
});
