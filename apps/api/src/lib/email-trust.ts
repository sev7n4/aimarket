/** 无需邮箱魔法链接即可消费积分的账号（已证明身份或测试专用） */
export function skipsEmailVerification(email: string): boolean {
  const lower = email.toLowerCase();
  if (lower.endsWith("@phone.aimarket")) return true;
  if (lower.endsWith("@wechat.aimarket")) return true;
  if (lower.endsWith("@test.local")) return true;
  return false;
}

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "yopmail.com",
  "throwaway.email",
]);

import { AppError } from "./errors.js";

export function assertRegisterableEmail(email: string) {
  const lower = email.toLowerCase();
  const domain = lower.split("@")[1];
  if (domain && DISPOSABLE_DOMAINS.has(domain)) {
    throw new AppError(
      400,
      "DISPOSABLE_EMAIL",
      "暂不支持临时邮箱注册，请使用常用邮箱",
    );
  }
}
