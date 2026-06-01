import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { INVITE_REWARD_CREDITS } from "./growth.js";
import { AppError } from "./errors.js";
import { skipsEmailVerification } from "./email-trust.js";

function generateInviteCode(): string {
  return randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function ensureInviteCode(userId: string): string {
  const row = db
    .prepare("SELECT code FROM invite_codes WHERE user_id = ?")
    .get(userId) as { code: string } | undefined;

  if (row) return row.code;

  let code = generateInviteCode();
  for (let i = 0; i < 5; i++) {
    const taken = db.prepare("SELECT code FROM invite_codes WHERE code = ?").get(code);
    if (!taken) break;
    code = generateInviteCode();
  }

  db.prepare("INSERT INTO invite_codes (user_id, code) VALUES (?, ?)").run(
    userId,
    code,
  );
  return code;
}

function grantInviteCredits(inviteeId: string, inviterId: string) {
  db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(
    INVITE_REWARD_CREDITS,
    inviteeId,
  );
  db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(
    INVITE_REWARD_CREDITS,
    inviterId,
  );
}

/** 邮箱验证通过后发放待处理的邀请奖励 */
export function grantPendingInviteRewards(inviteeId: string) {
  const row = db
    .prepare(
      `SELECT id, inviter_id FROM invite_redemptions
       WHERE invitee_id = ? AND rewards_granted_at IS NULL`,
    )
    .get(inviteeId) as { id: string; inviter_id: string } | undefined;

  if (!row) return;

  db.transaction(() => {
    grantInviteCredits(inviteeId, row.inviter_id);
    db.prepare(
      `UPDATE invite_redemptions SET rewards_granted_at = datetime('now') WHERE id = ?`,
    ).run(row.id);
  });
}

export function applyInviteOnRegister(
  inviteeId: string,
  inviteCode: string | undefined,
  inviteeEmail: string,
) {
  if (!inviteCode?.trim()) return null;

  const inviter = db
    .prepare("SELECT user_id FROM invite_codes WHERE code = ?")
    .get(inviteCode.trim().toUpperCase()) as { user_id: string } | undefined;

  if (!inviter) {
    throw new AppError(400, "INVALID_INVITE", "邀请码无效");
  }
  if (inviter.user_id === inviteeId) {
    throw new AppError(400, "INVALID_INVITE", "不能使用自己的邀请码");
  }

  const redeemed = db
    .prepare("SELECT id FROM invite_redemptions WHERE invitee_id = ?")
    .get(inviteeId);
  if (redeemed) return null;

  const redemptionId = randomUUID();
  const code = inviteCode.trim().toUpperCase();

  db.prepare(
    `INSERT INTO invite_redemptions (id, invitee_id, inviter_id, code) VALUES (?, ?, ?, ?)`,
  ).run(redemptionId, inviteeId, inviter.user_id, code);

  const grantNow = skipsEmailVerification(inviteeEmail);
  if (grantNow) {
    db.transaction(() => {
      grantInviteCredits(inviteeId, inviter.user_id);
      db.prepare(
        `UPDATE invite_redemptions SET rewards_granted_at = datetime('now') WHERE id = ?`,
      ).run(redemptionId);
    });
    return {
      inviterId: inviter.user_id,
      reward: INVITE_REWARD_CREDITS,
      pending: false,
    };
  }

  return {
    inviterId: inviter.user_id,
    reward: INVITE_REWARD_CREDITS,
    pending: true,
  };
}

export function getInviteStats(userId: string) {
  const code = ensureInviteCode(userId);
  const count = db
    .prepare(
      `SELECT COUNT(*) as c FROM invite_redemptions
       WHERE inviter_id = ? AND rewards_granted_at IS NOT NULL`,
    )
    .get(userId) as { c: number };
  const pending = db
    .prepare(
      `SELECT COUNT(*) as c FROM invite_redemptions
       WHERE inviter_id = ? AND rewards_granted_at IS NULL`,
    )
    .get(userId) as { c: number };
  return {
    code,
    inviteCount: count.c,
    pendingInviteCount: pending.c,
    rewardPerInvite: INVITE_REWARD_CREDITS,
    totalEarned: count.c * INVITE_REWARD_CREDITS,
  };
}
