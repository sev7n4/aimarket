import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { AppError } from "./errors.js";
import {
  getWorkspaceRole,
  requireWorkspaceRole,
  type WorkspaceRole,
} from "./workspace-members.js";

export type ReviewTargetType = "project" | "run" | "shot";
export type ReviewStatus = "open" | "resolved";

export interface WorkspaceReview {
  id: string;
  workspaceId: string;
  projectId: string | null;
  runId: string | null;
  shotId: string | null;
  targetType: ReviewTargetType;
  title: string;
  body: string | null;
  status: ReviewStatus;
  createdBy: string;
  createdByEmail: string;
  resolvedBy: string | null;
  resolvedByEmail: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
}

export interface ReviewComment {
  id: string;
  reviewId: string;
  userId: string;
  userEmail: string;
  content: string;
  mentions: string[];
  createdAt: string;
  updatedAt: string;
}

interface ReviewRow {
  id: string;
  workspace_id: string;
  project_id: string | null;
  run_id: string | null;
  shot_id: string | null;
  target_type: ReviewTargetType;
  title: string;
  body: string | null;
  status: ReviewStatus;
  created_by: string;
  created_by_email: string;
  resolved_by: string | null;
  resolved_by_email: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  comment_count: number;
}

interface CommentRow {
  id: string;
  review_id: string;
  user_id: string;
  user_email: string;
  content: string;
  mentions_json: string;
  created_at: string;
  updated_at: string;
}

function mapReview(row: ReviewRow): WorkspaceReview {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    runId: row.run_id,
    shotId: row.shot_id,
    targetType: row.target_type,
    title: row.title,
    body: row.body,
    status: row.status,
    createdBy: row.created_by,
    createdByEmail: row.created_by_email,
    resolvedBy: row.resolved_by,
    resolvedByEmail: row.resolved_by_email,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    commentCount: row.comment_count,
  };
}

function mapComment(row: CommentRow): ReviewComment {
  let mentions: string[] = [];
  try {
    mentions = JSON.parse(row.mentions_json || "[]") as string[];
  } catch {
    mentions = [];
  }
  return {
    id: row.id,
    reviewId: row.review_id,
    userId: row.user_id,
    userEmail: row.user_email,
    content: row.content,
    mentions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const REVIEW_SELECT = `
  SELECT r.id, r.workspace_id, r.project_id, r.run_id, r.shot_id,
         r.target_type, r.title, r.body, r.status,
         r.created_by, cu.email AS created_by_email,
         r.resolved_by, ru.email AS resolved_by_email,
         r.resolved_at, r.created_at, r.updated_at,
         (SELECT COUNT(*) FROM workspace_review_comments c WHERE c.review_id = r.id) AS comment_count
  FROM workspace_reviews r
  LEFT JOIN users cu ON cu.id = r.created_by
  LEFT JOIN users ru ON ru.id = r.resolved_by
`;

export function listWorkspaceReviews(
  userId: string,
  workspaceId: string,
  filters: {
    projectId?: string;
    runId?: string;
    shotId?: string;
    targetType?: ReviewTargetType;
    status?: ReviewStatus;
  } = {},
): WorkspaceReview[] {
  requireWorkspaceRole(userId, workspaceId, ["owner", "admin", "member"]);
  const where: string[] = ["r.workspace_id = ?"];
  const params: (string | null)[] = [workspaceId];
  if (filters.projectId) {
    where.push("r.project_id = ?");
    params.push(filters.projectId);
  }
  if (filters.runId) {
    where.push("r.run_id = ?");
    params.push(filters.runId);
  }
  if (filters.shotId) {
    where.push("r.shot_id = ?");
    params.push(filters.shotId);
  }
  if (filters.targetType) {
    where.push("r.target_type = ?");
    params.push(filters.targetType);
  }
  if (filters.status) {
    where.push("r.status = ?");
    params.push(filters.status);
  }
  const rows = db
    .prepare(
      `${REVIEW_SELECT} WHERE ${where.join(" AND ")} ORDER BY r.created_at DESC LIMIT 200`,
    )
    .all(...params) as unknown as ReviewRow[];
  return rows.map(mapReview);
}

export function getWorkspaceReview(
  userId: string,
  workspaceId: string,
  reviewId: string,
): WorkspaceReview {
  requireWorkspaceRole(userId, workspaceId, ["owner", "admin", "member"]);
  const row = db
    .prepare(`${REVIEW_SELECT} WHERE r.id = ? AND r.workspace_id = ?`)
    .get(reviewId, workspaceId) as unknown as ReviewRow | undefined;
  if (!row) {
    throw new AppError(404, "REVIEW_NOT_FOUND", "审片记录不存在");
  }
  return mapReview(row);
}

export function createWorkspaceReview(
  userId: string,
  workspaceId: string,
  input: {
    projectId?: string | null;
    runId?: string | null;
    shotId?: string | null;
    targetType: ReviewTargetType;
    title: string;
    body?: string | null;
  },
): WorkspaceReview {
  requireWorkspaceRole(userId, workspaceId, ["owner", "admin", "member"]);
  if (input.targetType === "shot" && !input.shotId) {
    throw new AppError(400, "INVALID_TARGET", "镜头级审片需提供 shotId");
  }
  if (input.targetType === "run" && !input.runId) {
    throw new AppError(400, "INVALID_TARGET", "成片级审片需提供 runId");
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO workspace_reviews
      (id, workspace_id, project_id, run_id, shot_id, target_type, title, body, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
  ).run(
    id,
    workspaceId,
    input.projectId ?? null,
    input.runId ?? null,
    input.shotId ?? null,
    input.targetType,
    input.title,
    input.body ?? null,
    userId,
  );
  return getWorkspaceReview(userId, workspaceId, id);
}

export function updateWorkspaceReviewStatus(
  userId: string,
  workspaceId: string,
  reviewId: string,
  status: ReviewStatus,
): WorkspaceReview {
  requireWorkspaceRole(userId, workspaceId, ["owner", "admin", "member"]);
  const existing = getWorkspaceReview(userId, workspaceId, reviewId);
  if (existing.status === status) return existing;

  const patch: { status: ReviewStatus; resolved_by?: string | null; resolved_at?: string | null } = {
    status,
  };
  if (status === "resolved") {
    patch.resolved_by = userId;
    patch.resolved_at = new Date().toISOString();
  } else {
    patch.resolved_by = null;
    patch.resolved_at = null;
  }

  db.prepare(
    `UPDATE workspace_reviews
       SET status = ?, resolved_by = ?, resolved_at = ?, updated_at = datetime('now')
     WHERE id = ? AND workspace_id = ?`,
  ).run(patch.status, patch.resolved_by, patch.resolved_at, reviewId, workspaceId);
  return getWorkspaceReview(userId, workspaceId, reviewId);
}

export function listReviewComments(
  userId: string,
  workspaceId: string,
  reviewId: string,
): ReviewComment[] {
  requireWorkspaceRole(userId, workspaceId, ["owner", "admin", "member"]);
  // 校验 review 属于该 workspace
  getWorkspaceReview(userId, workspaceId, reviewId);
  const rows = db
    .prepare(
      `SELECT c.id, c.review_id, c.user_id, u.email AS user_email,
              c.content, c.mentions_json, c.created_at, c.updated_at
         FROM workspace_review_comments c
         JOIN users u ON u.id = c.user_id
        WHERE c.review_id = ?
        ORDER BY c.created_at ASC`,
    )
    .all(reviewId) as unknown as CommentRow[];
  return rows.map(mapComment);
}

function parseMentions(content: string, mentionUserIds?: string[]): string[] {
  // 显式传入优先；否则从内容中提取 @uuid 形式（前端补全后传入）
  if (mentionUserIds && mentionUserIds.length) return mentionUserIds;
  const matches = content.match(/@\b[0-9a-f-]{8,}\b/gi) ?? [];
  return Array.from(new Set(matches.map((m) => m.slice(1))));
}

export function addReviewComment(
  userId: string,
  workspaceId: string,
  reviewId: string,
  input: {
    content: string;
    mentions?: string[];
  },
): ReviewComment {
  requireWorkspaceRole(userId, workspaceId, ["owner", "admin", "member"]);
  // 校验 review 属于该 workspace（resolved 也允许评论，便于追加备注）
  getWorkspaceReview(userId, workspaceId, reviewId);
  if (!input.content.trim()) {
    throw new AppError(400, "EMPTY_CONTENT", "评论内容不能为空");
  }

  // 校验 @mention 的用户是否在该 workspace
  const mentions = parseMentions(input.content, input.mentions);
  if (mentions.length) {
    const placeholders = mentions.map(() => "?").join(",");
    const valid = db
      .prepare(
        `SELECT user_id FROM workspace_members
          WHERE workspace_id = ? AND user_id IN (${placeholders})`,
      )
      .all(workspaceId, ...mentions) as { user_id: string }[];
    const validSet = new Set(valid.map((v) => v.user_id));
    mentions.forEach((m) => {
      if (!validSet.has(m)) {
        throw new AppError(400, "INVALID_MENTION", `@的用户不在工作区内: ${m}`);
      }
    });
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO workspace_review_comments (id, review_id, user_id, content, mentions_json)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, reviewId, userId, input.content, JSON.stringify(mentions));

  db.prepare(
    `UPDATE workspace_reviews SET updated_at = datetime('now') WHERE id = ?`,
  ).run(reviewId);

  const row = db
    .prepare(
      `SELECT c.id, c.review_id, c.user_id, u.email AS user_email,
              c.content, c.mentions_json, c.created_at, c.updated_at
         FROM workspace_review_comments c
         JOIN users u ON u.id = c.user_id
        WHERE c.id = ?`,
    )
    .get(id) as unknown as CommentRow | undefined;
  if (!row) {
    throw new AppError(500, "COMMENT_INSERT_FAILED", "评论写入失败");
  }
  return mapComment(row);
}

export function canUserResolveReview(
  userId: string,
  workspaceId: string,
): boolean {
  const role = getWorkspaceRole(userId, workspaceId);
  if (!role) return false;
  const allowed: WorkspaceRole[] = ["owner", "admin", "member"];
  return allowed.includes(role);
}
