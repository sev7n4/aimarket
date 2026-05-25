import type { Context, Next } from "hono";
import { AppError } from "../lib/errors.js";

export async function requireAdmin(c: Context, next: Next) {
  const secret = process.env.ADMIN_SECRET ?? "aimarket-admin-dev";
  const header = c.req.header("X-Admin-Secret");
  if (!header || header !== secret) {
    throw new AppError(403, "FORBIDDEN", "管理密钥无效");
  }
  await next();
}
