import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db/index.js";
import { hashPassword, signToken, verifyPassword } from "../lib/auth.js";
import { REGISTER_BONUS } from "../lib/growth.js";
import { applyInviteOnRegister } from "../lib/invite.js";
import { AppError } from "../lib/errors.js";
import { rateLimit } from "../lib/rate-limit.js";
import { ensurePersonalWorkspace } from "../lib/workspaces.js";

const auth = new Hono();

const registerSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(8, "密码至少 8 位"),
  inviteCode: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(8, "密码至少 8 位"),
});

auth.post("/register", async (c) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  await rateLimit(`register:${ip}`, 10, 60 * 60 * 1000);
  const body = registerSchema.parse(await c.req.json());
  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(body.email);
  if (existing) {
    throw new AppError(400, "EMAIL_EXISTS", "该邮箱已注册");
  }

  const id = randomUUID();
  const passwordHash = await hashPassword(body.password);
  db.prepare(
    "INSERT INTO users (id, email, password_hash, credits) VALUES (?, ?, ?, ?)",
  ).run(id, body.email.toLowerCase(), passwordHash, REGISTER_BONUS);

  const inviteResult = applyInviteOnRegister(id, body.inviteCode);
  ensurePersonalWorkspace(id);

  const token = await signToken(id);
  const user = db
    .prepare("SELECT id, email, credits, created_at FROM users WHERE id = ?")
    .get(id);

  return c.json(
    {
      data: {
        token,
        user,
        inviteBonus: inviteResult
          ? { reward: inviteResult.reward, message: "邀请奖励已发放" }
          : null,
      },
    },
    201,
  );
});

auth.post("/login", async (c) => {
  const body = loginSchema.parse(await c.req.json());
  const row = db
    .prepare(
      "SELECT id, email, password_hash, credits, created_at FROM users WHERE email = ?",
    )
    .get(body.email.toLowerCase()) as
    | {
        id: string;
        email: string;
        password_hash: string;
        credits: number;
        created_at: string;
      }
    | undefined;

  if (!row || !(await verifyPassword(body.password, row.password_hash))) {
    throw new AppError(401, "INVALID_CREDENTIALS", "邮箱或密码错误");
  }

  const token = await signToken(row.id);
  const { password_hash: _, ...user } = row;
  return c.json({ data: { token, user } });
});

export { auth };
