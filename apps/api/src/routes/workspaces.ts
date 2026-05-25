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

  const webBase =
    process.env.PUBLIC_WEB_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
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
