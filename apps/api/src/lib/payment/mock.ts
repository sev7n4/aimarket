import type { CheckoutInput, CheckoutResult, PaymentProvider } from "./types.js";

export const mockPaymentProvider: PaymentProvider = {
  name: "mock",
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const web = (process.env.PUBLIC_WEB_URL ?? "http://localhost:3000").replace(
      /\/$/,
      "",
    );
    return {
      provider: "mock",
      checkoutUrl: `${web}/pay/${input.orderId}`,
    };
  },
};
