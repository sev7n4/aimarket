import { mockPaymentProvider } from "./mock.js";
import { isStripeConfigured, stripePaymentProvider } from "./stripe.js";
import type { CheckoutInput, CheckoutResult, PaymentProvider } from "./types.js";

export function resolvePaymentProvider(): PaymentProvider {
  const mode = process.env.PAYMENT_PROVIDER ?? "auto";
  if (mode === "mock") return mockPaymentProvider;
  if (mode === "stripe" || (mode === "auto" && isStripeConfigured())) {
    return stripePaymentProvider;
  }
  return mockPaymentProvider;
}

export async function createCheckout(
  input: CheckoutInput,
): Promise<CheckoutResult> {
  return resolvePaymentProvider().createCheckout(input);
}

export function getPaymentStatus() {
  const provider = resolvePaymentProvider();
  return {
    mode: process.env.PAYMENT_PROVIDER ?? "auto",
    activeProvider: provider.name,
    stripeConfigured: isStripeConfigured(),
  };
}

export { fulfillOrder } from "./fulfill.js";
