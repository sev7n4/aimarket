import { request, getToken, setToken, assetUrl } from "./core";
import type {
  ApiErrorBody,
  ApiUser,
  ChatMessage,
  CreditPackage,
  GenerationJob,
  ImageModel,
  ImageSession,
  InspirationDetail,
  InspirationListItem,
  InviteInfo,
  PublicSharePayload,
  SessionShareStatus,
  Notice,
  ProductSetInit,
  RouteSuggestion,
  SessionAccessMeta,
  SessionReference,
  SignStatus,
  StudioTool,
  VideoModelRouteMeta,
  WorkspaceReview,
  WorkspaceReviewComment,
  DramaProjectVersionDetail,
  DramaProjectVersionDiff,
  DramaProjectVersionSummary,
} from "../types";

export async function fetchPackages() {
  const res = await request<{ data: CreditPackage[] }>(
    "/api/v1/product/packages",
  );
  return res.data;
}


export async function purchasePackage(packageId: string) {
  const res = await request<{
    data: {
      orderId: string;
      creditsAdded: number;
      user: ApiUser;
      message: string;
    };
  }>("/api/v1/product/purchase", {
    method: "POST",
    body: JSON.stringify({ packageId }),
  });
  return res.data;
}


export async function checkoutPackage(packageId: string) {
  const res = await request<{
    data: {
      orderId: string;
      checkoutUrl: string;
      provider: string;
      packageName: string;
      credits: number;
      priceCents: number;
    };
  }>("/api/v1/product/checkout", {
    method: "POST",
    body: JSON.stringify({ packageId }),
  });
  return res.data;
}


export async function fetchOrder(orderId: string) {
  const res = await request<{
    data: {
      id: string;
      status: string;
      credits: number;
      price_cents: number;
      package_name: string;
      checkout_url?: string;
    };
  }>(`/api/v1/product/orders/${orderId}`);
  return res.data;
}


export async function confirmOrder(orderId: string) {
  const res = await request<{
    data: {
      alreadyPaid: boolean;
      credits: number;
      user?: ApiUser;
      message: string;
    };
  }>(`/api/v1/product/orders/${orderId}/confirm`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return res.data;
}


export async function fetchPaymentStatus() {
  const res = await request<{
    data: { mode: string; activeProvider: string; stripeConfigured: boolean };
  }>("/api/v1/product/paymentStatus");
  return res.data;
}


export async function fetchSignStatus() {
  const res = await request<{ data: SignStatus }>("/api/v1/sign/check");
  return res.data;
}


export async function signIn() {
  const res = await request<{
    data: { creditsAdded: number; credits: number; message: string };
  }>("/api/v1/sign/in", { method: "POST", body: JSON.stringify({}) });
  return res.data;
}


export async function fetchInviteInfo() {
  const res = await request<{ data: InviteInfo }>(
    "/api/v1/inviteUser/generateCode",
  );
  return res.data;
}

