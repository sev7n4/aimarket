import { db } from "../../db/index.js";
import { AppError } from "../errors.js";
import { assertEmailVerifiedForSpend } from "../email-verification.js";

export function getUserCreditBalance(userId: string): number {
  const user = db
    .prepare(`SELECT credits FROM users WHERE id = ?`)
    .get(userId) as { credits: number } | undefined;
  if (!user) {
    throw new AppError(404, "NOT_FOUND", "用户不存在");
  }
  return user.credits;
}

export function dramaCreditsAffordability(
  userId: string,
  estimatedPoints: number,
): { ok: boolean; balance: number; shortfall: number } {
  const balance = getUserCreditBalance(userId);
  return {
    ok: balance >= estimatedPoints,
    balance,
    shortfall: Math.max(0, estimatedPoints - balance),
  };
}

export function formatDramaInsufficientCreditsMessage(
  estimatedPoints: number,
  balance: number,
): string {
  return `积分不足：本次约需 ${estimatedPoints} 分，当前余额 ${balance} 分，请充值后再制作`;
}

/** 开始制作前校验（与 generation_jobs 一致：需邮箱验证 + 余额充足） */
export function assertDramaCreditsAffordable(
  userId: string,
  estimatedPoints: number,
): void {
  assertEmailVerifiedForSpend(userId);
  const { ok, balance } = dramaCreditsAffordability(userId, estimatedPoints);
  if (!ok) {
    throw new AppError(
      402,
      "INSUFFICIENT_CREDITS",
      formatDramaInsufficientCreditsMessage(estimatedPoints, balance),
    );
  }
}
