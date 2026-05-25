import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AuthVariables } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { AppError } from "../lib/errors.js";

const product = new Hono<{ Variables: AuthVariables }>();

product.get("/queryPackageCount", (c) => {
  const row = db
    .prepare("SELECT COUNT(*) as count FROM credit_packages")
    .get() as { count: number };
  return c.json({ data: { count: row.count } });
});

product.get("/packages", (c) => {
  const packages = db
    .prepare(
      `SELECT id, name, credits, price_cents, badge, sort_order
       FROM credit_packages ORDER BY sort_order ASC`,
    )
    .all();
  return c.json({ data: packages });
});

product.get("/orders", (c) => {
  const userId = c.get("userId");
  const orders = db
    .prepare(
      `SELECT o.id, o.credits, o.price_cents, o.status, o.created_at, p.name as package_name
       FROM credit_orders o
       JOIN credit_packages p ON p.id = o.package_id
       WHERE o.user_id = ?
       ORDER BY o.created_at DESC LIMIT 20`,
    )
    .all(userId);
  return c.json({ data: orders });
});

/** Mock 支付：直接到账积分（Phase 3 不含真实支付网关） */
product.post("/purchase", async (c) => {
  const userId = c.get("userId");
  const body = z
    .object({ packageId: z.string() })
    .parse(await c.req.json());

  const pkg = db
    .prepare(
      "SELECT id, name, credits, price_cents FROM credit_packages WHERE id = ?",
    )
    .get(body.packageId) as
    | { id: string; name: string; credits: number; price_cents: number }
    | undefined;

  if (!pkg) throw new AppError(404, "NOT_FOUND", "套餐不存在");

  const orderId = randomUUID();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO credit_orders (id, user_id, package_id, credits, price_cents, status)
       VALUES (?, ?, ?, ?, ?, 'paid')`,
    ).run(orderId, userId, pkg.id, pkg.credits, pkg.price_cents);

    db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(
      pkg.credits,
      userId,
    );
  });

  const user = db
    .prepare("SELECT id, email, credits, created_at FROM users WHERE id = ?")
    .get(userId);

  return c.json({
    data: {
      orderId,
      packageName: pkg.name,
      creditsAdded: pkg.credits,
      user,
      message: "模拟支付成功，积分已到账",
    },
  });
});

export { product };
