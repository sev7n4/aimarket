import type { Context, Next } from "hono";
import { verifyToken } from "../lib/auth.js";
import { AppError } from "../lib/errors.js";

export type AuthVariables = {
  userId: string;
};

export async function requireAuth(c: Context, next: Next) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new AppError(401, "UNAUTHORIZED", "请先登录");
  }
  const token = header.slice(7);
  const userId = await verifyToken(token);
  c.set("userId", userId);
  await next();
}
