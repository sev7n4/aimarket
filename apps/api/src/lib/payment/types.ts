export interface CheckoutInput {
  orderId: string;
  packageId: string;
  packageName: string;
  credits: number;
  priceCents: number;
  userId: string;
  userEmail: string;
}

export interface CheckoutResult {
  provider: string;
  checkoutUrl: string;
  externalId?: string;
}

export interface PaymentProvider {
  name: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  verifyWebhook?(
    rawBody: string,
    signature: string | undefined,
  ): Promise<{ orderId: string; externalId: string } | null>;
}
