import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { sqlNow } from "../db/dialect.js";
import { AppError } from "./errors.js";
import { parseSkillFromYamlString } from "@aimarket/agent-skills";

export type MarketplaceSkillStatus =
  | "pending_review"
  | "published"
  | "rejected"
  | "archived";

export interface MarketplaceSkill {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  authorId: string;
  skillYaml: string;
  version: number;
  status: MarketplaceSkillStatus;
  installCount: number;
  adminNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MarketplaceSkillRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  author_id: string;
  skill_yaml: string;
  version: number;
  status: MarketplaceSkillStatus;
  install_count: number;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

function serialize(row: MarketplaceSkillRow): MarketplaceSkill {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    authorId: row.author_id,
    skillYaml: row.skill_yaml,
    version: row.version,
    status: row.status,
    installCount: row.install_count,
    adminNote: row.admin_note,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 生成 URL 友好 slug：小写 + 连字符 + 随机后缀避免冲突 */
function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const suffix = randomUUID().slice(0, 8);
  return `${base || "skill"}-${suffix}`;
}

export interface CreateMarketplaceSkillInput {
  authorId: string;
  name: string;
  description?: string;
  category?: string;
  skillYaml: string;
}

export function createMarketplaceSkill(
  input: CreateMarketplaceSkillInput,
): MarketplaceSkill {
  // 校验 YAML 是合法的 SkillDefinition
  const skill = parseSkillFromYamlString(input.skillYaml);
  if (skill.name !== input.name) {
    throw new AppError(
      400,
      "SKILL_NAME_MISMATCH",
      "YAML 中 skill.name 与提交的 name 不一致",
    );
  }

  const id = randomUUID();
  const slug = generateSlug(input.name);
  const now = sqlNow();

  db.prepare(
    `INSERT INTO marketplace_skills
      (id, slug, name, description, category, author_id, skill_yaml, version, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ${now}, ${now})`,
  ).run(
    id,
    slug,
    input.name,
    input.description ?? null,
    input.category ?? "general",
    input.authorId,
    input.skillYaml,
    skill.version,
  );

  const row = db
    .prepare("SELECT * FROM marketplace_skills WHERE id = ?")
    .get(id) as unknown as MarketplaceSkillRow;
  return serialize(row);
}

export function listPublishedMarketplaceSkills(opts: {
  pageNum?: number;
  pageSize?: number;
  category?: string;
}): { items: MarketplaceSkill[]; total: number } {
  const pageNum = Math.max(1, opts.pageNum ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 20));
  const offset = (pageNum - 1) * pageSize;
  const where = opts.category
    ? "WHERE status = 'published' AND category = ?"
    : "WHERE status = 'published'";
  const params = opts.category ? [opts.category, pageSize, offset] : [pageSize, offset];

  const items = db
    .prepare(
      `SELECT * FROM marketplace_skills ${where} ORDER BY published_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params) as unknown as MarketplaceSkillRow[];
  const totalRow = db
    .prepare(
      `SELECT COUNT(*) as cnt FROM marketplace_skills ${where}`,
    )
    .get(...(opts.category ? [opts.category] : [])) as unknown as { cnt: number };
  return { items: items.map(serialize), total: totalRow.cnt };
}

export function getMarketplaceSkill(slug: string): MarketplaceSkill | null {
  const row = db
    .prepare("SELECT * FROM marketplace_skills WHERE slug = ?")
    .get(slug) as unknown as MarketplaceSkillRow | undefined;
  return row ? serialize(row) : null;
}

export function listMyMarketplaceSkills(authorId: string): MarketplaceSkill[] {
  const rows = db
    .prepare(
      "SELECT * FROM marketplace_skills WHERE author_id = ? ORDER BY created_at DESC",
    )
    .all(authorId) as unknown as MarketplaceSkillRow[];
  return rows.map(serialize);
}

export function listPendingMarketplaceSkills(): MarketplaceSkill[] {
  const rows = db
    .prepare(
      "SELECT * FROM marketplace_skills WHERE status = 'pending_review' ORDER BY created_at ASC",
    )
    .all() as unknown as MarketplaceSkillRow[];
  return rows.map(serialize);
}

export function publishMarketplaceSkill(
  skillId: string,
  reviewerId: string | null,
): MarketplaceSkill {
  const row = db
    .prepare("SELECT * FROM marketplace_skills WHERE id = ?")
    .get(skillId) as unknown as MarketplaceSkillRow | undefined;
  if (!row) throw new AppError(404, "NOT_FOUND", "Skill 不存在");
  if (row.status === "published") {
    throw new AppError(400, "INVALID_STATE", "Skill 已发布");
  }
  const now = sqlNow();
  db.prepare(
    `UPDATE marketplace_skills
     SET status = 'published', reviewed_by = ?, reviewed_at = ${now}, published_at = ${now}, updated_at = ${now}
     WHERE id = ?`,
  ).run(reviewerId, skillId);
  const updated = db
    .prepare("SELECT * FROM marketplace_skills WHERE id = ?")
    .get(skillId) as unknown as MarketplaceSkillRow;
  return serialize(updated);
}

export function rejectMarketplaceSkill(
  skillId: string,
  reviewerId: string | null,
  reason: string,
): MarketplaceSkill {
  const row = db
    .prepare("SELECT * FROM marketplace_skills WHERE id = ?")
    .get(skillId) as unknown as MarketplaceSkillRow | undefined;
  if (!row) throw new AppError(404, "NOT_FOUND", "Skill 不存在");
  const now = sqlNow();
  db.prepare(
    `UPDATE marketplace_skills
     SET status = 'rejected', admin_note = ?, reviewed_by = ?, reviewed_at = ${now}, updated_at = ${now}
     WHERE id = ?`,
  ).run(reason, reviewerId, skillId);
  const updated = db
    .prepare("SELECT * FROM marketplace_skills WHERE id = ?")
    .get(skillId) as unknown as MarketplaceSkillRow;
  return serialize(updated);
}

/** 记录市场 Skill 安装（递增 install_count） */
export function recordMarketplaceInstall(slug: string): MarketplaceSkill {
  const row = db
    .prepare("SELECT * FROM marketplace_skills WHERE slug = ?")
    .get(slug) as unknown as MarketplaceSkillRow | undefined;
  if (!row || row.status !== "published") {
    throw new AppError(404, "NOT_FOUND", "Skill 不存在或未发布");
  }
  const now = sqlNow();
  db.prepare(
    `UPDATE marketplace_skills SET install_count = install_count + 1, updated_at = ${now} WHERE id = ?`,
  ).run(row.id);
  const updated = db
    .prepare("SELECT * FROM marketplace_skills WHERE id = ?")
    .get(row.id) as unknown as MarketplaceSkillRow;
  return serialize(updated);
}
