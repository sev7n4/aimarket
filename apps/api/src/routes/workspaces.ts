import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db/index.js";
import type { AuthVariables } from "../middleware/auth.js";
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

