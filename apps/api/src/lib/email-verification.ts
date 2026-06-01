import { createHash, randomBytes, randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { AppError } from "./errors.js";
import { grantPendingInviteRewards } from "./invite.js";
import { skipsEmailVerification } from "./email-trust.js";
import { sendVerificationEmail } from "./mail.js";
import { REGISTER_BONUS } from "./growth.js";
import { getPublicWebUrl } from "./public-url.js";

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

function verificationTtlMs() {
  const hours = Number(process.env.EMAIL_VERIFICATION_TTL_HOURS ?? "24");
  return Math.max(1, hours) * 60 * 60 * 1000;
}

export function publicAppUrl() {
  return getPublicWebUrl();
}

export function initialCreditsForRegister(email: string) {
  if (skipsEmailVerification(email)) {
    return {
      credits: REGISTER_BONUS,
      pending: 0,
      verifiedNow: true,
    };
  }
  return {
    credits: 0,
    pending: REGISTER_BONUS,
    verifiedNow: false,
  };
}

export function createVerificationToken(userId: string) {
  const raw = randomBytes(32).toString("hex");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + verificationTtlMs()).toISOString();
  const id = randomUUID();

  db.prepare(
    `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
  ).run(id, userId, tokenHash, expiresAt);

  return raw;
}

export async function sendEmailVerificationLink(userId: string, email: string) {
  const raw = createVerificationToken(userId);
  const verifyUrl = `${publicAppUrl()}/verify-email?token=${encodeURIComponent(raw)}`;
  await sendVerificationEmail({ to: email, verifyUrl });
  return verifyUrl;
}

export function grantEmailVerificationRewards(userId: string) {
  const user = db
    .prepare(
      `SELECT id, email, credits, pending_credits, email_verified_at FROM users WHERE id = ?`,
    )
    .get(userId) as
    | {
        id: string;
        email: string;
        credits: number;
        pending_credits: number;
        email_verified_at: string | null;
      }
    | undefined;

  if (!user) {
    throw new AppError(404, "NOT_FOUND", "用户不存在");
  }
  if (user.email_verified_at) {
    return { creditsGranted: 0, alreadyVerified: true };
  }

  const pending = user.pending_credits ?? 0;
  let creditsGranted = 0;

  db.transaction(() => {
    db.prepare(
      `UPDATE users
       SET email_verified_at = datetime('now'),
           credits = credits + ?,
           pending_credits = 0
       WHERE id = ?`,
    ).run(pending, userId);
    creditsGranted = pending;
  });

  grantPendingInviteRewards(userId);

  return { creditsGranted, alreadyVerified: false };
}

export async function verifyEmailWithToken(rawToken: string) {
  const tokenHash = hashToken(rawToken.trim());
  const row = db
    .prepare(
      `SELECT t.id, t.user_id, t.expires_at, t.consumed_at, u.email
       FROM email_verification_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ?`,
    )
    .get(tokenHash) as
    | {
        id: string;
        user_id: string;
        expires_at: string;
        consumed_at: string | null;
        email: string;
      }
    | undefined;

  if (!row) {
    throw new AppError(400, "INVALID_TOKEN", "验证链接无效或已过期");
  }
  if (row.consumed_at) {
    throw new AppError(400, "TOKEN_USED", "该验证链接已使用，请重新发送验证邮件");
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw new AppError(400, "TOKEN_EXPIRED", "验证链接已过期，请重新发送验证邮件");
  }

  db.prepare(
    `UPDATE email_verification_tokens SET consumed_at = datetime('now') WHERE id = ?`,
  ).run(row.id);

  const { creditsGranted, alreadyVerified } = grantEmailVerificationRewards(
    row.user_id,
  );

  return {
    userId: row.user_id,
    email: row.email,
    creditsGranted,
    alreadyVerified,
  };
}

export function assertEmailVerifiedForSpend(userId: string) {
  const row = db
    .prepare("SELECT email, email_verified_at FROM users WHERE id = ?")
    .get(userId) as { email: string; email_verified_at: string | null } | undefined;

  if (!row) {
    throw new AppError(404, "NOT_FOUND", "用户不存在");
  }
  if (skipsEmailVerification(row.email) || row.email_verified_at) {
    return;
  }
  throw new AppError(
    403,
    "EMAIL_NOT_VERIFIED",
    "请先验证邮箱后再使用积分生成",
  );
}
