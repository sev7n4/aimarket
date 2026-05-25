import { db } from "../../db/index.js";
import { AppError } from "../errors.js";

/** 将 pending 订单标记为已支付并发放积分（幂等） */
export function fulfillOrder(orderId: string, externalId?: string) {
  const order = db
    .prepare(
      `SELECT id, user_id, package_id, credits, status FROM credit_orders WHERE id = ?`,
    )
    .get(orderId) as
    | {
        id: string;
        user_id: string;
        package_id: string;
        credits: number;
        status: string;
      }
    | undefined;

  if (!order) {
    throw new AppError(404, "NOT_FOUND", "订单不存在");
  }
  if (order.status === "paid") {
    return { alreadyPaid: true, credits: order.credits };
  }
  if (order.status !== "pending") {
    throw new AppError(400, "INVALID_STATUS", "订单状态不可支付");
  }

  db.transaction(() => {
    db.prepare(
      `UPDATE credit_orders
       SET status = 'paid', paid_at = datetime('now'), external_id = COALESCE(?, external_id)
       WHERE id = ? AND status = 'pending'`,
    ).run(externalId ?? null, orderId);

    db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(
      order.credits,
      order.user_id,
    );
  });

  const user = db
    .prepare("SELECT id, email, credits, created_at FROM users WHERE id = ?")
    .get(order.user_id);

  return { alreadyPaid: false, credits: order.credits, user };
}
