import type { CheckoutInput, CheckoutResult, PaymentProvider } from "./types.js";

function getStripeKey() {
  return process.env.STRIPE_SECRET_KEY?.trim();
}

export const stripePaymentProvider: PaymentProvider = {
  name: "stripe",
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const key = getStripeKey();
    if (!key) throw new Error("未配置 STRIPE_SECRET_KEY");

    const web = (process.env.PUBLIC_WEB_URL ?? "http://localhost:3000").replace(
      /\/$/,
      "",
    );

    const body = new URLSearchParams({
      mode: "payment",
      success_url: `${web}/pay/success?orderId=${input.orderId}`,
      cancel_url: `${web}/pay/cancel?orderId=${input.orderId}`,
      "line_items[0][price_data][currency]": "cny",
      "line_items[0][price_data][product_data][name]": `${input.packageName} · ${input.credits}积分`,
      "line_items[0][price_data][unit_amount]": String(input.priceCents),
      "line_items[0][quantity]": "1",
      "metadata[orderId]": input.orderId,
      "metadata[userId]": input.userId,
      "metadata[packageId]": input.packageId,
      customer_email: input.userEmail,
    });

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const json = (await res.json()) as {
      id?: string;
      url?: string;
      error?: { message?: string };
    };

    if (!res.ok || !json.url || !json.id) {
      throw new Error(json.error?.message ?? "Stripe 创建会话失败");
    }

    return {
      provider: "stripe",
      checkoutUrl: json.url,
      externalId: json.id,
    };
  },

  async verifyWebhook(rawBody, signature) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !signature) return null;

    // Phase 5：解析 checkout.session.completed（生产应校验 Stripe 签名）
    try {
      const event = JSON.parse(rawBody) as {
        type?: string;
        data?: {
          object?: { metadata?: { orderId?: string }; id?: string };
        };
      };
      if (event.type !== "checkout.session.completed") return null;
      const orderId = event.data?.object?.metadata?.orderId;
      const externalId = event.data?.object?.id;
      if (!orderId || !externalId) return null;
      return { orderId, externalId };
    } catch {
      return null;
    }
  },
};

export function isStripeConfigured() {
  return Boolean(getStripeKey());
}
