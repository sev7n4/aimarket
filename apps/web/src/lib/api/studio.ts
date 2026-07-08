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

export async function fetchTools() {
  const res = await request<{ data: StudioTool[] }>("/api/v1/tools/list");
  return res.data;
}


export async function fetchBrandKit() {
  const res = await request<{ data: Record<string, unknown> | null }>(
    "/api/v1/brandKit",
  );
  return res.data;
}


export async function saveBrandKit(body: {
  brandName?: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  fontHint?: string;
}) {
  const res = await request<{ data: Record<string, unknown> }>(
    "/api/v1/brandKit",
    { method: "PUT", body: JSON.stringify(body) },
  );
  return res.data;
}


export async function fetchProviderStatus() {
  const res = await request<{
    data: import("../provider-status-types").ProviderStatusPayload;
  }>("/api/v1/ai/providerStatus");
  return res.data;
}


export async function submitContentReport(body: {
  sessionId: string;
  jobId?: string;
  reason: string;
  contentUrl?: string;
}) {
  const res = await request<{ data: { id: string; status: string } }>(
    "/api/v1/reports",
    { method: "POST", body: JSON.stringify(body) },
  );
  return res.data;
}


export async function trackEvent(
  name: string,
  props?: Record<string, string | number | boolean>,
  options?: { auth?: boolean },
) {
  await request("/api/v1/events", {
    method: "POST",
    body: JSON.stringify({ name, props }),
    auth: options?.auth ?? true,
  }).catch(() => {});
}

