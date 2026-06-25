import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db/index.js";
import type { AuthVariables } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import {
  createWorkspaceInvite,
  joinWorkspaceByCode,
  listWorkspaceMembers,
  removeWorkspaceMember,
  requireWorkspaceRole,
} from "../lib/workspace-members.js";
import { getUserDefaultWorkspaceId } from "../lib/workspaces.js";
import { getPublicWebUrl } from "../lib/public-url.js";
import {
  addReviewComment,
  createWorkspaceReview,
  getWorkspaceReview,
  listReviewComments,
  listWorkspaceReviews,
  updateWorkspaceReviewStatus,
  type ReviewStatus,
  type ReviewTargetType,
} from "../lib/workspace-reviews.js";

export const workspacesRoute = new Hono<{ Variables: AuthVariables }>();

workspacesRoute.get("/list", (c) => {
  const userId = c.get("userId");
  getUserDefaultWorkspaceId(userId);
  const rows = db
    .prepare(
      `SELECT w.id, w.name, w.is_personal, m.role, w.created_at
       FROM workspaces w
       JOIN workspace_members m ON m.workspace_id = w.id
       WHERE m.user_id = ?
       ORDER BY w.is_personal DESC, w.created_at ASC`,
    )
    .all(userId);
  return c.json({ data: rows });
});

workspacesRoute.post("/create", async (c) => {
  const userId = c.get("userId");
  const body = z
    .object({ name: z.string().min(1).max(50) })
    .parse(await c.req.json());

  const workspaceId = randomUUID();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO workspaces (id, name, owner_id, is_personal) VALUES (?, ?, ?, 0)`,
    ).run(workspaceId, body.name, userId);
    db.prepare(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')`,
    ).run(workspaceId, userId);
  });

  return c.json(
    {
      data: {
        id: workspaceId,
        name: body.name,
        is_personal: 0,
        role: "owner",
      },
    },
    201,
  );
});

workspacesRoute.post("/join", async (c) => {
  const userId = c.get("userId");
  const body = z
    .object({ code: z.string().min(4).max(32) })
    .parse(await c.req.json());

  const result = joinWorkspaceByCode(userId, body.code);
  return c.json({ data: result });
});

workspacesRoute.get("/:workspaceId/members", (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");
  const members = listWorkspaceMembers(workspaceId, userId);
  return c.json({ data: members });
});

workspacesRoute.post("/:workspaceId/invites", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");
  const body = z
    .object({
      role: z.enum(["member", "admin"]).default("member"),
      maxUses: z.number().int().min(1).max(100).optional(),
      expiresInDays: z.number().int().min(1).max(90).optional(),
    })
    .parse(await c.req.json());

  const invite = createWorkspaceInvite(workspaceId, userId, {
    role: body.role,
    maxUses: body.maxUses,
    expiresInDays: body.expiresInDays,
  });

  const webBase = getPublicWebUrl();
  const joinUrl = `${webBase}/join?code=${invite.code}`;

  return c.json(
    {
      data: {
        ...invite,
        joinUrl,
      },
    },
    201,
  );
});

workspacesRoute.delete("/:workspaceId/members/:memberId", (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");
  const memberId = c.req.param("memberId");
  removeWorkspaceMember(workspaceId, userId, memberId);
  return c.json({ data: { ok: true } });
});

// PROD-C06 — Workspace 审片评论
const targetTypeSchema = z.enum(["project", "run", "shot"]);
const reviewStatusSchema = z.enum(["open", "resolved"]);

workspacesRoute.get("/:workspaceId/reviews", (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");
  const q = c.req.query();
  const reviews = listWorkspaceReviews(userId, workspaceId, {
    projectId: q.projectId || undefined,
    runId: q.runId || undefined,
    shotId: q.shotId || undefined,
    targetType: (q.targetType as ReviewTargetType | undefined) || undefined,
    status: (q.status as ReviewStatus | undefined) || undefined,
  });
  return c.json({ data: reviews });
});

workspacesRoute.post("/:workspaceId/reviews", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");
  const body = z
    .object({
      projectId: z.string().uuid().nullable().optional(),
      runId: z.string().uuid().nullable().optional(),
      shotId: z.string().nullable().optional(),
      targetType: targetTypeSchema.default("project"),
      title: z.string().min(1).max(200),
      body: z.string().max(4000).nullable().optional(),
    })
    .parse(await c.req.json());
  const review = createWorkspaceReview(userId, workspaceId, {
    projectId: body.projectId ?? null,
    runId: body.runId ?? null,
    shotId: body.shotId ?? null,
    targetType: body.targetType,
    title: body.title,
    body: body.body ?? null,
  });
  return c.json({ data: review }, 201);
});

workspacesRoute.get("/:workspaceId/reviews/:reviewId", (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");
  const reviewId = c.req.param("reviewId");
  const review = getWorkspaceReview(userId, workspaceId, reviewId);
  return c.json({ data: review });
});

workspacesRoute.patch("/:workspaceId/reviews/:reviewId", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");
  const reviewId = c.req.param("reviewId");
  const body = z
    .object({ status: reviewStatusSchema })
    .parse(await c.req.json());
  const review = updateWorkspaceReviewStatus(
    userId,
    workspaceId,
    reviewId,
    body.status,
  );
  return c.json({ data: review });
});

workspacesRoute.get("/:workspaceId/reviews/:reviewId/comments", (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");
  const reviewId = c.req.param("reviewId");
  const comments = listReviewComments(userId, workspaceId, reviewId);
  return c.json({ data: comments });
});

workspacesRoute.post("/:workspaceId/reviews/:reviewId/comments", async (c) => {
  const userId = c.get("userId");
  const workspaceId = c.req.param("workspaceId");
  const reviewId = c.req.param("reviewId");
  const body = z
    .object({
      content: z.string().min(1).max(4000),
      mentions: z.array(z.string().uuid()).optional(),
    })
    .parse(await c.req.json());
  const comment = addReviewComment(userId, workspaceId, reviewId, {
    content: body.content,
    mentions: body.mentions,
  });
  return c.json({ data: comment }, 201);
});
