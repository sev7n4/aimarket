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
import { assertRegisterableEmail } from "../lib/email-trust.js";
import {
  initialCreditsForRegister,
  sendEmailVerificationLink,
  verifyEmailWithToken,
} from "../lib/email-verification.js";
import { mapUserPublic, USER_PUBLIC_SELECT } from "../lib/user-public.js";
import type { AuthVariables } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";

const auth = new Hono<{ Variables: AuthVariables }>();

const registerSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(8, "密码至少 8 位"),
  inviteCode: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(8, "密码至少 8 位"),
});

const verifyEmailSchema = z.object({
  token: z.string().min(16).max(128),
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

function fetchUserById(id: string) {
  return db
    .prepare(`SELECT ${USER_PUBLIC_SELECT} FROM users WHERE id = ?`)
    .get(id) as
    | {
        id: string;
        email: string;
        credits: number;
        pending_credits: number;
        email_verified_at: string | null;
        created_at: string;
        phone: string | null;
      }
    | undefined;
}

function inviteBonusPayload(
  inviteResult: ReturnType<typeof applyInviteOnRegister>,
) {
  if (!inviteResult) return null;
  const message =
    inviteResult.pending ?
      "邀请关系已记录，验证邮箱后双方各得邀请奖励"
    : "邀请奖励已发放";
  return { reward: inviteResult.reward, message, pending: inviteResult.pending };
}

async function findOrCreateByPhone(phone: string, inviteCode?: string) {
  const normalized = normalizePhone(phone);
  const existing = db
    .prepare(`SELECT ${USER_PUBLIC_SELECT} FROM users WHERE phone = ?`)
    .get(normalized) as Parameters<typeof mapUserPublic>[0] | undefined;
  if (existing) {
    return { user: mapUserPublic(existing), inviteBonus: null };
  }

  const id = randomUUID();
  const email = phoneEmail(normalized);
  const passwordHash = await hashPassword(randomUUID());
  db.prepare(
    `INSERT INTO users (id, email, password_hash, credits, pending_credits, phone, email_verified_at)
     VALUES (?, ?, ?, ?, 0, ?, datetime('now'))`,
  ).run(id, email, passwordHash, REGISTER_BONUS, normalized);

  const inviteResult = applyInviteOnRegister(id, inviteCode, email);
  ensurePersonalWorkspace(id);
  const user = fetchUserById(id)!;

  return {
    user: mapUserPublic(user),
    inviteBonus: inviteBonusPayload(inviteResult),
  };
}

async function findOrCreateByWechat(code: string, inviteCode?: string) {
  const openId =
    code === "mock" || code.startsWith("mock_")
      ? `mock_${code.slice(0, 32)}`
      : `wx_${code.slice(0, 48)}`;

  const existing = db
    .prepare(`SELECT ${USER_PUBLIC_SELECT} FROM users WHERE wechat_open_id = ?`)
    .get(openId) as Parameters<typeof mapUserPublic>[0] | undefined;
  if (existing) {
    return { user: mapUserPublic(existing), inviteBonus: null };
  }

  const id = randomUUID();
  const email = wechatEmail(openId);
  const passwordHash = await hashPassword(randomUUID());
  db.prepare(
    `INSERT INTO users (id, email, password_hash, credits, pending_credits, wechat_open_id, email_verified_at)
     VALUES (?, ?, ?, ?, 0, ?, datetime('now'))`,
  ).run(id, email, passwordHash, REGISTER_BONUS, openId);

  const inviteResult = applyInviteOnRegister(id, inviteCode, email);
  ensurePersonalWorkspace(id);
  const user = fetchUserById(id)!;

  return {
    user: mapUserPublic(user),
    inviteBonus: inviteBonusPayload(inviteResult),
  };
}

auth.post("/register", async (c) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const registerLimit =
    process.env.E2E_RELAX_RATE_LIMIT === "true" ? 10_000 : 10;
  await rateLimit(`register:${ip}`, registerLimit, 60 * 60 * 1000);
  const body = registerSchema.parse(await c.req.json());
  const email = body.email.toLowerCase();
  assertRegisterableEmail(email);

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    throw new AppError(400, "EMAIL_EXISTS", "该邮箱已注册");
  }

  const { credits, pending, verifiedNow } = initialCreditsForRegister(email);
  const id = randomUUID();
  const passwordHash = await hashPassword(body.password);

  db.prepare(
    `INSERT INTO users (id, email, password_hash, credits, pending_credits, email_verified_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    email,
    passwordHash,
    credits,
    pending,
    verifiedNow ? new Date().toISOString() : null,
  );

  const inviteResult = applyInviteOnRegister(id, body.inviteCode, email);
  ensurePersonalWorkspace(id);

  let verificationEmailSent = false;
  if (!verifiedNow) {
    await sendEmailVerificationLink(id, email);
    verificationEmailSent = true;
  }

  const token = await signToken(id);
  const user = mapUserPublic(fetchUserById(id)!);

  return c.json(
    {
      data: {
        token,
        user,
        inviteBonus: inviteBonusPayload(inviteResult),
        verificationEmailSent,
        message:
          verifiedNow ?
            undefined
          : "注册成功，请查收验证邮件，验证后到账注册积分",
      },
    },
    201,
  );
});

auth.post("/verify-email", async (c) => {
  const body = verifyEmailSchema.parse(await c.req.json());
  const result = await verifyEmailWithToken(body.token);
  const token = await signToken(result.userId);
  const user = mapUserPublic(fetchUserById(result.userId)!);

  return c.json({
    data: {
      token,
      user,
      creditsGranted: result.creditsGranted,
      alreadyVerified: result.alreadyVerified,
      message:
        result.alreadyVerified ?
          "邮箱已验证"
        : `验证成功，已到账 ${result.creditsGranted} 积分`,
    },
  });
});

auth.post("/resend-verification", requireAuth, async (c) => {
  const userId = c.get("userId");
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  await rateLimit(`resend-verify:${userId}`, 1, 60 * 1000);
  await rateLimit(`resend-verify-ip:${ip}`, 10, 60 * 60 * 1000);

  const row = db
    .prepare("SELECT id, email, email_verified_at FROM users WHERE id = ?")
    .get(userId) as
    | { id: string; email: string; email_verified_at: string | null }
    | undefined;

  if (!row) throw new AppError(404, "NOT_FOUND", "用户不存在");
  if (row.email_verified_at) {
    throw new AppError(400, "ALREADY_VERIFIED", "邮箱已验证，无需重复发送");
  }

  await sendEmailVerificationLink(row.id, row.email);
  return c.json({
    data: { message: "验证邮件已发送，请查收邮箱" },
  });
});

auth.post("/login", async (c) => {
  const body = loginSchema.parse(await c.req.json());
  const row = db
    .prepare(
      `SELECT id, email, password_hash, credits, pending_credits, email_verified_at, created_at, phone
       FROM users WHERE email = ?`,
    )
    .get(body.email.toLowerCase()) as
    | {
        id: string;
        email: string;
        password_hash: string;
        credits: number;
        pending_credits: number;
        email_verified_at: string | null;
        created_at: string;
        phone: string | null;
      }
    | undefined;

  if (!row || !(await verifyPassword(body.password, row.password_hash))) {
    throw new AppError(401, "INVALID_CREDENTIALS", "邮箱或密码错误");
  }

  const token = await signToken(row.id);
  const { password_hash: _, ...rest } = row;
  return c.json({ data: { token, user: mapUserPublic(rest) } });
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
