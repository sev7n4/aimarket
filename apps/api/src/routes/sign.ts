import { Hono } from "hono";
import type { AuthVariables } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { SIGN_DAILY_CREDITS } from "../lib/growth.js";
import { AppError } from "../lib/errors.js";

const sign = new Hono<{ Variables: AuthVariables }>();

function todayUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

sign.get("/check", (c) => {
  const userId = c.get("userId");
  const date = todayUtcDate();
  const row = db
    .prepare(
      "SELECT sign_date, credits FROM sign_records WHERE user_id = ? AND sign_date = ?",
    )
    .get(userId, date);

  const streak = db
    .prepare(
      `SELECT COUNT(*) as c FROM sign_records
       WHERE user_id = ? AND sign_date >= date('now', '-7 days')`,
    )
    .get(userId) as { c: number };

  return c.json({
    data: {
      signedToday: Boolean(row),
      todayReward: SIGN_DAILY_CREDITS,
      recentSignDays: streak.c,
      signDate: date,
    },
  });
});

sign.post("/in", (c) => {
  const userId = c.get("userId");
  const date = todayUtcDate();

  const existing = db
    .prepare(
      "SELECT sign_date FROM sign_records WHERE user_id = ? AND sign_date = ?",
    )
    .get(userId, date);

  if (existing) {
    throw new AppError(400, "ALREADY_SIGNED", "今日已签到");
  }

  db.transaction(() => {
    db.prepare(
      "INSERT INTO sign_records (user_id, sign_date, credits) VALUES (?, ?, ?)",
    ).run(userId, date, SIGN_DAILY_CREDITS);
    db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(
      SIGN_DAILY_CREDITS,
      userId,
    );
  });

  const user = db
    .prepare("SELECT credits FROM users WHERE id = ?")
    .get(userId) as { credits: number };

  return c.json({
    data: {
      creditsAdded: SIGN_DAILY_CREDITS,
      credits: user.credits,
      message: `签到成功，获得 ${SIGN_DAILY_CREDITS} 积分`,
    },
  });
});

export { sign };
