import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AuthVariables } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { AppError } from "../lib/errors.js";
import {
  createCheckout,
  fulfillOrder,
  getPaymentStatus,
} from "../lib/payment/index.js";
import { stripePaymentProvider } from "../lib/payment/stripe.js";

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

product.get("/paymentStatus", (c) => c.json({ data: getPaymentStatus() }));

product.get("/orders", (c) => {
  const userId = c.get("userId");
  const orders = db
    .prepare(
      `SELECT o.id, o.credits, o.price_cents, o.status, o.provider, o.created_at, o.paid_at, p.name as package_name
       FROM credit_orders o
       JOIN credit_packages p ON p.id = o.package_id
       WHERE o.user_id = ?
       ORDER BY o.created_at DESC LIMIT 20`,
    )
    .all(userId);
  return c.json({ data: orders });
});

product.get("/orders/:orderId", (c) => {
  const userId = c.get("userId");
  const orderId = c.req.param("orderId");
  const order = db
    .prepare(
      `SELECT o.id, o.credits, o.price_cents, o.status, o.provider, o.checkout_url, o.created_at, o.paid_at, p.name as package_name
       FROM credit_orders o
       JOIN credit_packages p ON p.id = o.package_id
       WHERE o.id = ? AND o.user_id = ?`,
    )
    .get(orderId, userId);
  if (!order) throw new AppError(404, "NOT_FOUND", "订单不存在");
  return c.json({ data: order });
});

/** Phase 5：创建待支付订单并返回收银台 URL */
product.post("/checkout", async (c) => {
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

  const user = db
    .prepare("SELECT id, email FROM users WHERE id = ?")
    .get(userId) as { id: string; email: string };

  const orderId = randomUUID();
  const checkout = await createCheckout({
    orderId,
    packageId: pkg.id,
    packageName: pkg.name,
    credits: pkg.credits,
    priceCents: pkg.price_cents,
    userId,
    userEmail: user.email,
  });

  db.prepare(
    `INSERT INTO credit_orders
     (id, user_id, package_id, credits, price_cents, status, provider, external_id, checkout_url)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
  ).run(
    orderId,
    userId,
    pkg.id,
    pkg.credits,
    pkg.price_cents,
    checkout.provider,
    checkout.externalId ?? null,
    checkout.checkoutUrl,
  );

  return c.json({
    data: {
      orderId,
      checkoutUrl: checkout.checkoutUrl,
      provider: checkout.provider,
      packageName: pkg.name,
      credits: pkg.credits,
      priceCents: pkg.price_cents,
    },
  });
});

/** Mock 收银台确认支付（仅 pending + 本人订单） */
product.post("/orders/:orderId/confirm", (c) => {
  const userId = c.get("userId");
  const orderId = c.req.param("orderId");

  const order = db
    .prepare("SELECT id, user_id, status FROM credit_orders WHERE id = ?")
    .get(orderId) as { id: string; user_id: string; status: string } | undefined;

  if (!order || order.user_id !== userId) {
    throw new AppError(404, "NOT_FOUND", "订单不存在");
  }

  const result = fulfillOrder(orderId);
  return c.json({
    data: {
      ...result,
      message: result.alreadyPaid
        ? "订单已支付"
        : `支付成功，已充值 ${result.credits} 积分`,
    },
  });
});

/** @deprecated Phase 3 模拟直充，保留兼容 */
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

  db.prepare(
    `INSERT INTO credit_orders
     (id, user_id, package_id, credits, price_cents, status, provider, paid_at)
     VALUES (?, ?, ?, ?, ?, 'paid', 'legacy', datetime('now'))`,
  ).run(orderId, userId, pkg.id, pkg.credits, pkg.price_cents);

  db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(
    pkg.credits,
    userId,
  );

  const user = db
    .prepare("SELECT id, email, credits, created_at FROM users WHERE id = ?")
    .get(userId);

  return c.json({
    data: {
      orderId,
      packageName: pkg.name,
      creditsAdded: pkg.credits,
      user,
      message: "模拟支付成功，积分已到账（legacy）",
    },
  });
});

export const productWebhook = new Hono();

productWebhook.post("/stripe", async (c) => {
  const raw = await c.req.text();
  const signature = c.req.header("stripe-signature");
  const verified = await stripePaymentProvider.verifyWebhook?.(
    raw,
    signature,
  );
  if (!verified) {
    return c.json({ error: { message: "invalid webhook" } }, 400);
  }
  fulfillOrder(verified.orderId, verified.externalId);
  return c.json({ received: true });
});

export { product };
