import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db/index.js";
import { hashPassword, signToken, verifyPassword } from "../lib/auth.js";
import { REGISTER_BONUS } from "../lib/growth.js";
import { applyInviteOnRegister } from "../lib/invite.js";
import { AppError } from "../lib/errors.js";
import { rateLimit } from "../lib/rate-limit.js";
import { issueSmsCode, verifySmsCode } from "../lib/sms-mock.js";
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

const phoneSchema = z
  .string()
  .regex(/^1\d{10}$/, "请输入 11 位中国大陆手机号");

const smsSendSchema = z.object({
  phone: phoneSchema,
});

const smsLoginSchema = z.object({
  phone: phoneSchema,
  code: z.string().min(4).max(8),
  inviteCode: z.string().optional(),
});

const wechatLoginSchema = z.object({
  code: z.string().min(1).max(512),
  inviteCode: z.string().optional(),
});

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function phoneEmail(phone: string) {
  return `${normalizePhone(phone)}@phone.aimarket`;
}

function wechatEmail(openId: string) {
  return `wx_${openId}@wechat.aimarket`;
}

function selectUserPublic(row: {
  id: string;
  email: string;
  credits: number;
  created_at: string;
  phone?: string | null;
}) {
  return {
    id: row.id,
    email: row.email,
    credits: row.credits,
    created_at: row.created_at,
    phone: row.phone ?? undefined,
  };
}

async function findOrCreateByPhone(phone: string, inviteCode?: string) {
  const normalized = normalizePhone(phone);
  const existing = db
    .prepare(
      "SELECT id, email, credits, created_at, phone FROM users WHERE phone = ?",
    )
    .get(normalized) as
    | {
        id: string;
        email: string;
        credits: number;
        created_at: string;
        phone: string | null;
      }
    | undefined;
  if (existing) {
    return { user: selectUserPublic(existing), inviteBonus: null };
  }

  const id = randomUUID();
  const email = phoneEmail(normalized);
  const passwordHash = await hashPassword(randomUUID());
  db.prepare(
    "INSERT INTO users (id, email, password_hash, credits, phone) VALUES (?, ?, ?, ?, ?)",
  ).run(id, email, passwordHash, REGISTER_BONUS, normalized);

  const inviteResult = applyInviteOnRegister(id, inviteCode);
  ensurePersonalWorkspace(id);
  const user = db
    .prepare(
      "SELECT id, email, credits, created_at, phone FROM users WHERE id = ?",
    )
    .get(id) as {
    id: string;
    email: string;
    credits: number;
    created_at: string;
    phone: string | null;
  };

  return {
    user: selectUserPublic(user),
    inviteBonus: inviteResult
      ? { reward: inviteResult.reward, message: "邀请奖励已发放" }
      : null,
  };
}

async function findOrCreateByWechat(code: string, inviteCode?: string) {
  const openId =
    code === "mock" || code.startsWith("mock_")
      ? `mock_${code.slice(0, 32)}`
      : `wx_${code.slice(0, 48)}`;

  const existing = db
    .prepare(
      "SELECT id, email, credits, created_at, phone FROM users WHERE wechat_open_id = ?",
    )
    .get(openId) as
    | {
        id: string;
        email: string;
        credits: number;
        created_at: string;
        phone: string | null;
      }
    | undefined;
  if (existing) {
    return { user: selectUserPublic(existing), inviteBonus: null };
  }

  const id = randomUUID();
  const email = wechatEmail(openId);
  const passwordHash = await hashPassword(randomUUID());
  db.prepare(
    `INSERT INTO users (id, email, password_hash, credits, wechat_open_id)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, email, passwordHash, REGISTER_BONUS, openId);

  const inviteResult = applyInviteOnRegister(id, inviteCode);
  ensurePersonalWorkspace(id);
  const user = db
    .prepare(
      "SELECT id, email, credits, created_at, phone FROM users WHERE id = ?",
    )
    .get(id) as {
    id: string;
    email: string;
    credits: number;
    created_at: string;
    phone: string | null;
  };

  return {
    user: selectUserPublic(user),
    inviteBonus: inviteResult
      ? { reward: inviteResult.reward, message: "邀请奖励已发放" }
      : null,
  };
}

auth.post("/register", async (c) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const registerLimit =
    process.env.E2E_RELAX_RATE_LIMIT === "true" ? 10_000 : 10;
  await rateLimit(`register:${ip}`, registerLimit, 60 * 60 * 1000);
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
    .prepare(
      "SELECT id, email, credits, created_at, phone FROM users WHERE id = ?",
    )
    .get(id) as {
    id: string;
    email: string;
    credits: number;
    created_at: string;
    phone: string | null;
  };

  return c.json(
    {
      data: {
        token,
        user: selectUserPublic(user),
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
      "SELECT id, email, password_hash, credits, created_at, phone FROM users WHERE email = ?",
    )
    .get(body.email.toLowerCase()) as
    | {
        id: string;
        email: string;
        password_hash: string;
        credits: number;
        created_at: string;
        phone: string | null;
      }
    | undefined;

  if (!row || !(await verifyPassword(body.password, row.password_hash))) {
    throw new AppError(401, "INVALID_CREDENTIALS", "邮箱或密码错误");
  }

  const token = await signToken(row.id);
  const { password_hash: _, ...rest } = row;
  return c.json({ data: { token, user: selectUserPublic(rest) } });
});

auth.post("/sms/send", async (c) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  await rateLimit(`sms:${ip}`, 8, 60 * 60 * 1000);
  const body = smsSendSchema.parse(await c.req.json());
  const phone = normalizePhone(body.phone);
  const code = issueSmsCode(phone);
  const devHint =
    process.env.NODE_ENV !== "production"
      ? { devCode: code, message: "开发环境已返回验证码" }
      : { message: "验证码已发送" };
  return c.json({ data: devHint });
});

auth.post("/sms/login", async (c) => {
  const body = smsLoginSchema.parse(await c.req.json());
  const phone = normalizePhone(body.phone);
  if (!verifySmsCode(phone, body.code)) {
    throw new AppError(401, "INVALID_SMS_CODE", "验证码错误或已过期");
  }
  const { user, inviteBonus } = await findOrCreateByPhone(
    phone,
    body.inviteCode,
  );
  const token = await signToken(user.id);
  return c.json({ data: { token, user, inviteBonus } });
});

auth.post("/wechat/login", async (c) => {
  const body = wechatLoginSchema.parse(await c.req.json());
  const { user, inviteBonus } = await findOrCreateByWechat(
    body.code,
    body.inviteCode,
  );
  const token = await signToken(user.id);
  return c.json({ data: { token, user, inviteBonus } });
});

export { auth };
