import { Hono } from "hono";
import { db } from "../db/index.js";
import type { AuthVariables } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";

const user = new Hono<{ Variables: AuthVariables }>();

user.get("/getInfo", (c) => {
  const userId = c.get("userId");
  const row = db
    .prepare("SELECT id, email, credits, created_at FROM users WHERE id = ?")
    .get(userId);
  if (!row) throw new AppError(404, "NOT_FOUND", "用户不存在");
  return c.json({ data: row });
});

user.get("/queryPoints", (c) => {
  const userId = c.get("userId");
  const row = db
    .prepare("SELECT credits FROM users WHERE id = ?")
    .get(userId) as { credits: number } | undefined;
  if (!row) throw new AppError(404, "NOT_FOUND", "用户不存在");
  return c.json({ data: { credits: row.credits } });
});

export { user };
