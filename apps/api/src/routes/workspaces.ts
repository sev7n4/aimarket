import { Hono } from "hono";
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
