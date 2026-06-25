import { resolveApiBase } from "@/lib/api-base";
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
} from "./types";

const API_BASE = resolveApiBase();

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("aimarket_token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("aimarket_token", token);
  else localStorage.removeItem("aimarket_token");
}

async function request<T>(
  path: string,
  init?: RequestInit & { auth?: boolean },
): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  if (init?.body && !(init.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (init?.auth !== false) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = json as ApiErrorBody;
    throw new Error(err.error?.message ?? `请求失败 (${res.status})`);
  }
  return json as T;
}

export function assetUrl(path: string) {
  const normalized = path.trim();
  if (
    normalized.startsWith("http") ||
    normalized.startsWith("blob:") ||
    normalized.startsWith("data:")
  ) {
    return normalized;
  }
  const relativePath = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return `${API_BASE}${relativePath}`;
}

export async function register(
  email: string,
  password: string,
  inviteCode?: string,
) {
  const res = await request<{
    data: {
      token: string;
      user: ApiUser;
      inviteBonus?: {
        reward: number;
        message: string;
        pending?: boolean;
      } | null;
      verificationEmailSent?: boolean;
      message?: string;
    };
  }>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, inviteCode }),
    auth: false,
  });
  setToken(res.data.token);
  return res.data;
}

export async function verifyEmail(token: string) {
  const res = await request<{
    data: {
      token: string;
      user: ApiUser;
      creditsGranted: number;
      alreadyVerified: boolean;
      message: string;
    };
  }>("/api/v1/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
    auth: false,
  });
  setToken(res.data.token);
  return res.data;
}

export async function resendVerificationEmail() {
  const res = await request<{ data: { message: string } }>(
    "/api/v1/auth/resend-verification",
    { method: "POST" },
  );
  return res.data;
}

export async function login(email: string, password: string) {
  const res = await request<{ data: { token: string; user: ApiUser } }>(
    "/api/v1/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
      auth: false,
    },
  );
  setToken(res.data.token);
  return res.data;
}

export function logout() {
  setToken(null);
}

export async function sendSmsCode(phone: string) {
  const res = await request<{
    data: { message: string; devCode?: string };
  }>("/api/v1/auth/sms/send", {
    method: "POST",
    body: JSON.stringify({ phone }),
    auth: false,
  });
  return res.data;
}

export async function loginWithSms(
  phone: string,
  code: string,
  inviteCode?: string,
) {
  const res = await request<{
    data: {
      token: string;
      user: ApiUser;
      inviteBonus?: { reward: number; message: string } | null;
    };
  }>("/api/v1/auth/sms/login", {
    method: "POST",
    body: JSON.stringify({ phone, code, inviteCode }),
    auth: false,
  });
  setToken(res.data.token);
  return res.data;
}

export async function loginWithWechat(code: string, inviteCode?: string) {
  const res = await request<{
    data: {
      token: string;
      user: ApiUser;
      inviteBonus?: { reward: number; message: string } | null;
    };
  }>("/api/v1/auth/wechat/login", {
    method: "POST",
    body: JSON.stringify({ code, inviteCode }),
    auth: false,
  });
  setToken(res.data.token);
  return res.data;
}

export async function fetchUser() {
  const res = await request<{ data: ApiUser }>("/api/v1/user/getInfo");
  return res.data;
}

export async function fetchPoints() {
  const res = await request<{ data: { credits: number } }>(
    "/api/v1/user/queryPoints",
  );
  return res.data.credits;
}

export interface UserProviderConfig {
  useByok: boolean;
  openai: {
    configured: boolean;
    keyHint: string | null;
    baseUrl: string | null;
  };
  server?: {
    openaiConfigured: boolean;
    imageProviderMode: string;
  };
}

export async function fetchUserProviderConfig() {
  const res = await request<{ data: UserProviderConfig }>(
    "/api/v1/user/providerConfig",
  );
  return res.data;
}

export async function saveUserProviderConfig(body: {
  useByok?: boolean;
  openai?: { apiKey?: string | null; baseUrl?: string | null };
}) {
  const res = await request<{ data: UserProviderConfig }>(
    "/api/v1/user/providerConfig",
    { method: "PUT", body: JSON.stringify(body) },
  );
  return res.data;
}

export interface EnsureSessionSourceInspiration {
  id: string;
  title: string;
  prompt: string;
  modelId: string;
  aspectRatio: string;
  resolution: string;
  variables?: { key: string; label: string; default: string }[];
  variableValues: Record<string, string>;
  referenceUrls: string[];
  coverUrl?: string | null;
  mediaType?: "image" | "video";
  dramaTemplate?: import("./types").DramaTemplateMetadata;
}

export async function ensureSession(
  sessionId: string,
  mode: string,
  options?: {
    title?: string;
    kind?: "canvas" | "project";
    workspaceId?: string;
    sourceInspirationId?: string;
  },
) {
  const res = await request<{
    data: ImageSession & {
      sourceInspiration?: EnsureSessionSourceInspiration | null;
    };
  }>("/api/v1/imageSession/ensure", {
    method: "POST",
    body: JSON.stringify({
      sessionId,
      mode,
      title: options?.title,
      kind: options?.kind,
      workspaceId: options?.workspaceId,
      sourceInspirationId: options?.sourceInspirationId,
    }),
  });
  return res.data;
}

export async function fetchSession(sessionId: string) {
  const res = await request<{
    data: ImageSession & {
      sourceInspiration?: EnsureSessionSourceInspiration | null;
    };
  }>(`/api/v1/imageSession/${encodeURIComponent(sessionId)}`);
  return res.data;
}

export async function listSessions(
  limit = 20,
  kind?: "canvas" | "project",
  workspaceId?: string,
) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (kind) params.set("kind", kind);
  if (workspaceId) params.set("workspaceId", workspaceId);
  const res = await request<{ data: ImageSession[] }>(
    `/api/v1/imageSession/list?${params.toString()}`,
  );
  return res.data;
}

export async function updateSessionTitle(sessionId: string, title: string) {
  const res = await request<{ data: ImageSession }>(
    `/api/v1/imageSession/${sessionId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ title }),
    },
  );
  return res.data;
}

export async function deleteSession(sessionId: string) {
  const res = await request<{ data: { deleted: boolean; sessionId: string } }>(
    `/api/v1/imageSession/${sessionId}`,
    { method: "DELETE" },
  );
  return res.data;
}

export async function fetchSessionShareStatus(sessionId: string) {
  const res = await request<{ data: SessionShareStatus }>(
    `/api/v1/imageSession/${sessionId}/share`,
  );
  return res.data;
}

export async function createSessionShare(sessionId: string) {
  const res = await request<{
    data: { shareUrl: string; expiresAt: string; shareId: string };
  }>(`/api/v1/imageSession/${sessionId}/share`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return res.data;
}

export async function revokeSessionShare(sessionId: string) {
  const res = await request<{ data: { revoked: boolean } }>(
    `/api/v1/imageSession/${sessionId}/share`,
    { method: "DELETE" },
  );
  return res.data;
}

export async function fetchPublicShare(token: string) {
  const res = await request<{ data: PublicSharePayload }>(
    `/api/v1/share/${encodeURIComponent(token)}`,
    { auth: false },
  );
  return res.data;
}

export async function fetchMessages(sessionId: string) {
  const res = await request<{
    data: ChatMessage[];
    meta?: SessionAccessMeta;
  }>(`/api/v1/imageSession/${sessionId}/messages`);
  return { messages: res.data, meta: res.meta };
}

export interface CanvasLayoutDto {
  version: 1;
  items: {
    id: string;
    url: string;
    thumbUrl?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    label?: string;
    isVideo?: boolean;
    source?: "upload" | "generation";
    role?: "reference" | "product" | "output";
    assetId?: string;
    outputId?: string;
    batchId?: string;
    batchIndex?: number;
    batchTitle?: string;
    batchSubtitle?: string;
    parentBatchId?: string;
    sourceItemId?: string;
  }[];
}

export async function fetchCanvasLayout(sessionId: string) {
  const res = await request<{ data: CanvasLayoutDto }>(
    `/api/v1/imageSession/${sessionId}/canvas`,
  );
  return res.data;
}

export interface CanvasBundleDto {
  layout: CanvasLayoutDto;
  messages: ChatMessage[];
  meta?: SessionAccessMeta;
}

export async function fetchCanvasBundle(sessionId: string) {
  const res = await request<{ data: CanvasBundleDto }>(
    `/api/v1/imageSession/${sessionId}/canvas-bundle`,
  );
  return res.data;
}

export async function saveCanvasLayout(
  sessionId: string,
  layout: CanvasLayoutDto,
) {
  const res = await request<{ data: CanvasLayoutDto }>(
    `/api/v1/imageSession/${sessionId}/canvas`,
    {
      method: "PUT",
      body: JSON.stringify(layout),
    },
  );
  return res.data;
}

export async function fetchModels() {
  const res = await request<{
    data: ImageModel[];
    meta?: {
      videoAuto?: {
        modelId: string;
        provider: string;
        modelName?: string;
        routingHint?: string;
        upstreamLabel?: string;
      };
      videoRoutes?: VideoModelRouteMeta[];
    };
  }>("/api/v1/ai/queryModels");
  videoAutoMeta = res.meta?.videoAuto ?? null;
  videoRoutesMeta = res.meta?.videoRoutes ?? [];
  return res.data;
}

let videoAutoMeta: {
  modelId: string;
  provider: string;
  modelName?: string;
  routingHint?: string;
  upstreamLabel?: string;
} | null = null;

let videoRoutesMeta: VideoModelRouteMeta[] = [];

/** 视频车道 Auto 实际使用的 modelId（来自 queryModels meta） */
export function getVideoAutoModelMeta() {
  return videoAutoMeta;
}

/** 各视频模型路由与可用性（来自 queryModels meta） */
export function getVideoModelRoutesMeta(): VideoModelRouteMeta[] {
  return videoRoutesMeta;
}

export function getVideoModelRoute(modelId: string): VideoModelRouteMeta | undefined {
  return videoRoutesMeta.find((r) => r.modelId === modelId);
}

export async function estimatePoints(
  modelId: string,
  count: number,
  resolution: string,
) {
  const res = await request<{ data: { totalPoints: number } }>(
    "/api/v1/ai/estimatePointsBatch",
    {
      method: "POST",
      body: JSON.stringify({
        items: [{ modelId, count, resolution }],
      }),
    },
  );
  return res.data.totalPoints;
}

export async function suggestModel(
  mode: string,
  prompt: string,
  hasReferenceImages?: boolean,
) {
  const res = await request<{ data: RouteSuggestion }>(
    "/api/v1/ai/suggestModel",
    {
      method: "POST",
      body: JSON.stringify({ mode, prompt, hasReferenceImages }),
    },
  );
  return res.data;
}

export async function fetchReferences(sessionId: string) {
  const res = await request<{ data: SessionReference[] }>(
    `/api/v1/imageSession/${sessionId}/references`,
  );
  return res.data;
}

export async function fetchProductSetInit() {
  const res = await request<{ data: ProductSetInit }>(
    "/api/v1/productSet/init",
    { auth: false },
  );
  return res.data;
}

export async function submitGeneration(body: {
  sessionId: string;
  prompt: string;
  modelId?: string;
  count: number;
  resolution: string;
  aspectRatio?: string;
  mode: string;
  assetIds?: string[];
  referenceOutputIds?: string[];
  autoRoute?: boolean;
  toolContext?: {
    toolId: string;
    masks: Array<{
      itemId: string;
      mode: "brush" | "box";
      maskDataUrl: string;
      bbox: { x: number; y: number; width: number; height: number };
      normalizedBbox: { x: number; y: number; width: number; height: number };
    }>;
  };
  parentJobId?: string;
  sourceOutputId?: string;
  sourceLane?: "agent" | "image" | "video";
}) {
  const res = await request<{
    data: {
      jobId: string;
      estimatedPoints: number;
      status: string;
      modelId?: string;
      routingMode?: "auto" | "explicit" | "byok";
      qualityTier?: "standard" | "pro";
      routeReason?: string;
      byokActive?: boolean;
    };
  }>("/api/v1/ai/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function submitEcommerceGenerate(body: {
  sessionId: string;
  brand?: string;
  platform: string;
  market: string;
  language: string;
  productInfo: string;
  designer?: string;
  modelId?: string;
  resolution?: string;
  productAssetId?: string;
  referenceAssetId?: string;
  parentJobId?: string;
  sourceOutputId?: string;
}) {
  const res = await request<{
    data: {
      jobId: string;
      estimatedPoints: number;
      modelId: string;
      routeReason: string;
      slideCount: number;
    };
  }>("/api/v1/productSet/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function submitEcommerceRerunSlide(body: {
  sessionId: string;
  slideKey: "main" | "selling" | "scene" | "detail";
  brand?: string;
  platform: string;
  market: string;
  language: string;
  productInfo: string;
  designer?: string;
  modelId?: string;
  resolution?: string;
  productAssetId?: string;
  referenceAssetId?: string;
  parentJobId?: string;
  sourceOutputId?: string;
}) {
  const res = await request<{
    data: {
      jobId: string;
      estimatedPoints: number;
      modelId: string;
      routeReason: string;
      slideKey: "main" | "selling" | "scene" | "detail";
      slideLabel: string;
    };
  }>("/api/v1/productSet/rerun-slide", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

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

export async function exportSession(sessionId: string) {
  const res = await request<{
    data: { sessionId: string; title: string; files: { url: string }[]; count: number };
  }>(`/api/v1/imageSession/${sessionId}/export`);
  return res.data;
}

export async function fetchProviderStatus() {
  const res = await request<{
    data: import("./provider-status-types").ProviderStatusPayload;
  }>("/api/v1/ai/providerStatus");
  return res.data;
}

export async function submitVideoGeneration(body: {
  sessionId: string;
  prompt: string;
  modelId: string;
  count?: number;
  resolution?: string;
  aspectRatio?: string;
  videoResolution?: import("./creation-dock-prefs").VideoResolution;
  parentJobId?: string;
  sourceOutputId?: string;
  referenceMode?: import("./creation-dock-prefs").VideoReferenceMode;
  durationSec?: import("./creation-dock-prefs").VideoDurationSec;
  videoReferences?: import("./creation-dock-prefs").VideoMediaRef[];
  smartMultiShots?: import("./creation-dock-prefs").SmartMultiShot[];
  assetIds?: string[];
  referenceOutputIds?: string[];
  sourceLane?: import("./creation-dock-prefs").CreationLane;
}) {
  const res = await request<{
    data: { jobId: string; estimatedPoints: number };
  }>("/api/v1/ai/generate/video", {
    method: "POST",
    body: JSON.stringify(body),
  });
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

export async function fetchWorkspaces() {
  const res = await request<{
    data: {
      id: string;
      name: string;
      is_personal: number;
      role: string;
      created_at: string;
    }[];
  }>("/api/v1/workspaces/list");
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

export async function fetchAdminStats(adminSecret: string) {
  const res = await fetch(`${API_BASE}/api/v1/admin/stats`, {
    headers: { "X-Admin-Secret": adminSecret },
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as ApiErrorBody).error?.message ?? "失败");
  return json as { data: Record<string, unknown> };
}

export async function fetchAdminUsers(adminSecret: string) {
  const res = await fetch(`${API_BASE}/api/v1/admin/users`, {
    headers: { "X-Admin-Secret": adminSecret },
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as ApiErrorBody).error?.message ?? "失败");
  return (json as { data: Record<string, unknown>[] }).data;
}

export async function fetchAdminAnalytics(
  adminSecret: string,
  days = 7,
) {
  const res = await fetch(
    `${API_BASE}/api/v1/admin/analytics?days=${days}`,
    { headers: { "X-Admin-Secret": adminSecret } },
  );
  const json = await res.json();
  if (!res.ok) throw new Error((json as ApiErrorBody).error?.message ?? "失败");
  return json as {
    data: {
      days: number;
      total: number;
      byName: { name: string; count: number }[];
      recent: Record<string, unknown>[];
    };
  };
}

export async function createWorkspace(name: string) {
  const res = await request<{
    data: { id: string; name: string; is_personal: number; role: string };
  }>("/api/v1/workspaces/create", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return res.data;
}

export async function joinWorkspace(code: string) {
  const res = await request<{
    data: {
      workspaceId: string;
      workspaceName: string;
      role: string;
      alreadyMember: boolean;
    };
  }>("/api/v1/workspaces/join", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  return res.data;
}

export async function createWorkspaceInvite(workspaceId: string) {
  const res = await request<{
    data: { code: string; joinUrl: string; role: string };
  }>(`/api/v1/workspaces/${workspaceId}/invites`, {
    method: "POST",
    body: JSON.stringify({ role: "member", expiresInDays: 7 }),
  });
  return res.data;
}

export async function fetchWorkspaceMembers(workspaceId: string) {
  const res = await request<{
    data: { id: string; email: string; role: string }[];
  }>(`/api/v1/workspaces/${workspaceId}/members`);
  return res.data;
}

export async function removeWorkspaceMember(
  workspaceId: string,
  memberId: string,
) {
  await request(`/api/v1/workspaces/${workspaceId}/members/${memberId}`, {
    method: "DELETE",
  });
}

// PROD-C06 — Workspace 审片评论
export async function fetchWorkspaceReviews(
  workspaceId: string,
  filters: {
    projectId?: string;
    runId?: string;
    shotId?: string;
    targetType?: "project" | "run" | "shot";
    status?: "open" | "resolved";
  } = {},
) {
  const params = new URLSearchParams();
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.runId) params.set("runId", filters.runId);
  if (filters.shotId) params.set("shotId", filters.shotId);
  if (filters.targetType) params.set("targetType", filters.targetType);
  if (filters.status) params.set("status", filters.status);
  const qs = params.toString();
  const res = await request<{ data: WorkspaceReview[] }>(
    `/api/v1/workspaces/${workspaceId}/reviews${qs ? `?${qs}` : ""}`,
  );
  return res.data;
}

export async function createWorkspaceReview(
  workspaceId: string,
  input: {
    projectId?: string | null;
    runId?: string | null;
    shotId?: string | null;
    targetType: "project" | "run" | "shot";
    title: string;
    body?: string | null;
  },
) {
  const res = await request<{ data: WorkspaceReview }>(
    `/api/v1/workspaces/${workspaceId}/reviews`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  return res.data;
}

export async function patchWorkspaceReviewStatus(
  workspaceId: string,
  reviewId: string,
  status: "open" | "resolved",
) {
  const res = await request<{ data: WorkspaceReview }>(
    `/api/v1/workspaces/${workspaceId}/reviews/${reviewId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
  return res.data;
}

export async function fetchWorkspaceReviewComments(
  workspaceId: string,
  reviewId: string,
) {
  const res = await request<{ data: WorkspaceReviewComment[] }>(
    `/api/v1/workspaces/${workspaceId}/reviews/${reviewId}/comments`,
  );
  return res.data;
}

export async function addWorkspaceReviewComment(
  workspaceId: string,
  reviewId: string,
  input: { content: string; mentions?: string[] },
) {
  const res = await request<{ data: WorkspaceReviewComment }>(
    `/api/v1/workspaces/${workspaceId}/reviews/${reviewId}/comments`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  return res.data;
}

// PROD-C07 — 版本对比与回滚
export async function fetchDramaProjectVersions(projectId: string) {
  const res = await request<{ data: DramaProjectVersionSummary[] }>(
    `/api/v1/drama/projects/${projectId}/versions`,
  );
  return res.data;
}

export async function fetchDramaProjectVersion(
  projectId: string,
  versionId: string,
) {
  const res = await request<{ data: DramaProjectVersionDetail }>(
    `/api/v1/drama/projects/${projectId}/versions/${versionId}`,
  );
  return res.data;
}

export async function diffDramaProjectVersions(
  projectId: string,
  versionAId: string,
  versionBId: string,
) {
  const res = await request<{ data: DramaProjectVersionDiff }>(
    `/api/v1/drama/projects/${projectId}/versions/${versionAId}/diff/${versionBId}`,
  );
  return res.data;
}

export async function restoreDramaProjectVersion(
  projectId: string,
  versionId: string,
  note?: string,
) {
  const res = await request<{ data: DramaProjectVersionDetail }>(
    `/api/v1/drama/projects/${projectId}/restore/${versionId}`,
    {
      method: "POST",
      body: JSON.stringify(note ? { note } : {}),
    },
  );
  return res.data;
}

export async function fetchAdminReports(
  adminSecret: string,
  status = "pending",
) {
  const res = await fetch(
    `${API_BASE}/api/v1/admin/reports?status=${status}`,
    { headers: { "X-Admin-Secret": adminSecret } },
  );
  const json = await res.json();
  if (!res.ok) throw new Error((json as ApiErrorBody).error?.message ?? "失败");
  return (json as { data: Record<string, unknown>[] }).data;
}

export async function updateAdminReport(
  adminSecret: string,
  id: string,
  body: { status: "pending" | "reviewed" | "dismissed"; adminNote?: string },
) {
  const res = await fetch(`${API_BASE}/api/v1/admin/reports/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Secret": adminSecret,
    },
    body: JSON.stringify({
      status: body.status,
      adminNote: body.adminNote,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as ApiErrorBody).error?.message ?? "失败");
  return json;
}

export async function recognizeFocusPoint(body: {
  sessionId: string;
  imageUrl?: string;
  imageBase64?: string;
  x?: number;
  y?: number;
  cropSize?: number;
}) {
  const res = await request<{
    data: { pointId: string; objectName: string; provider: string };
  }>("/api/v1/focus/point", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function runTool(
  toolId: string,
  body: {
    sessionId: string;
    prompt?: string;
    resolution?: string;
    aspectRatio?: string;
    count?: number;
    referenceOutputIds?: string[];
    assetIds?: string[];
    scale?: "2x" | "4x";
    intent?: "edit" | "replace";
    extend?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
      direction?: "all" | "left" | "right" | "up" | "down";
    };
    focusPoints?: Array<{
      pointId: string;
      objectName: string;
      x?: number;
      y?: number;
    }>;
    toolContext?: {
      toolId: string;
      masks: Array<{
        itemId: string;
        mode: "brush" | "box";
        maskDataUrl: string;
        bbox: { x: number; y: number; width: number; height: number };
        normalizedBbox: { x: number; y: number; width: number; height: number };
      }>;
    };
  },
) {
  const res = await request<{
    data: { jobId: string; estimatedPoints: number; tool: string };
  }>(`/api/v1/tools/${toolId}/run`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function fetchJob(jobId: string) {
  const res = await request<{ data: GenerationJob }>(`/api/v1/ai/jobs/${jobId}`);
  return res.data;
}

export async function cancelJob(jobId: string) {
  const res = await request<{
    data: { status: string; refundedPoints: number };
  }>(`/api/v1/ai/jobs/${jobId}/cancel`, {
    method: "POST",
  });
  return res.data;
}

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

export async function fetchLatestNotice() {
  const res = await request<{ data: Notice | null }>(
    "/api/v1/notice/latestNotice",
    { auth: false },
  );
  return res.data;
}

export async function dismissNotice(noticeId: string) {
  await request(`/api/v1/notice/${noticeId}/dismiss`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchInspirationPage(opts?: {
  pageNum?: number;
  pageSize?: number;
  category?: string;
  /** 首页扇形套图专用 */
  fanSet?: "apparel";
}) {
  const params = new URLSearchParams();
  if (opts?.pageNum) params.set("pageNum", String(opts.pageNum));
  if (opts?.pageSize) params.set("pageSize", String(opts.pageSize));
  if (opts?.fanSet) {
    params.set("fanSet", opts.fanSet);
  } else if (opts?.category && opts.category !== "全部") {
    params.set("category", opts.category);
  }
  const q = params.toString();
  const res = await request<{
    data: { total: number; rows: InspirationListItem[] };
  }>(`/api/v1/inspiration/page${q ? `?${q}` : ""}`, { auth: false });
  return res.data;
}

export async function fetchInspirationDetail(id: string) {
  const res = await request<{ data: InspirationDetail }>(
    `/api/v1/inspiration/${encodeURIComponent(id)}`,
    { auth: false },
  );
  return res.data;
}

export async function renderInspiration(
  id: string,
  variables?: Record<string, string>,
) {
  const res = await request<{ data: InspirationDetail }>(
    `/api/v1/inspiration/${encodeURIComponent(id)}/render`,
    {
      method: "POST",
      body: JSON.stringify({ variables }),
      auth: false,
    },
  );
  return res.data;
}

export async function publishCanvasToInspiration(body: {
  coverUrl?: string;
  prompt?: string;
  title?: string;
  modelId?: string;
  aspectRatio?: string;
  resolution?: string;
  referenceUrls?: string[];
  outputId?: string;
  assetId?: string;
  dramaTemplate?: import("./types").DramaTemplateMetadata;
}) {
  const res = await request<{ data: InspirationDetail }>(
    "/api/v1/inspiration/publish",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
  return res.data;
}

/** 当前用户已发布到灵感画廊的条目 */
export async function fetchMyInspirations(opts?: {
  pageNum?: number;
  pageSize?: number;
}) {
  const q = new URLSearchParams();
  if (opts?.pageNum) q.set("pageNum", String(opts.pageNum));
  if (opts?.pageSize) q.set("pageSize", String(opts.pageSize));
  const res = await request<{
    data: { total: number; rows: InspirationListItem[] };
  }>(`/api/v1/inspiration/mine${q.size ? `?${q}` : ""}`);
  return res.data;
}

/** 撤回灵感画廊发布（软删） */
export async function unpublishInspiration(id: string) {
  const res = await request<{ data: { id: string; status: string } }>(
    `/api/v1/inspiration/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  return res.data;
}

export async function forkInspirationProject(
  id: string,
  body?: {
    variables?: Record<string, string>;
    mode?: "chat" | "image" | "ecommerce";
    workspaceId?: string;
  },
) {
  const res = await request<{
    data: {
      session: ImageSession;
      inspiration: InspirationDetail;
      estimatedPoints: number;
    };
  }>(`/api/v1/inspiration/${encodeURIComponent(id)}/fork-project`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
  return res.data;
}

/** 制片模板：复制灵感到新制片 Session（PROD-B06） */
export async function copyInspirationToProductionSession(
  id: string,
  body?: { workspaceId?: string },
) {
  const res = await request<{
    data: {
      session: ImageSession;
      dramaTemplate: import("./types").DramaTemplateMetadata;
      inspiration: { id: string; title: string; coverUrl: string; category: string };
    };
  }>(`/api/v1/inspiration/${encodeURIComponent(id)}/copy-to-session`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
  return res.data;
}

export async function fetchAgentPlan(body: {
  prompt: string;
  mode: string;
  modelId?: string;
  resolution?: string;
  aspectRatio?: string;
  count?: number;
}) {
  const res = await request<{ data: import("./types").AgentPlan }>(
    "/api/v1/agent/plan",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
  return res.data;
}

export async function createAgentRun(body: {
  sessionId: string;
  prompt: string;
  mode: "chat" | "image" | "ecommerce";
  modelId?: string;
  resolution?: string;
  aspectRatio?: string;
  count?: number;
}) {
  const res = await request<{ data: import("./types").AgentRun }>(
    "/api/v1/agent/runs",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
  return res.data;
}

export async function fetchAgentRun(runId: string) {
  const res = await request<{ data: import("./types").AgentRun }>(
    `/api/v1/agent/runs/${encodeURIComponent(runId)}`,
  );
  return res.data;
}

export async function confirmAgentRun(runId: string) {
  const res = await request<{ data: import("./types").AgentRun }>(
    `/api/v1/agent/runs/${encodeURIComponent(runId)}/confirm`,
    { method: "POST" },
  );
  return res.data;
}

export async function cancelAgentRun(runId: string) {
  const res = await request<{ data: import("./types").AgentRun }>(
    `/api/v1/agent/runs/${encodeURIComponent(runId)}/cancel`,
    { method: "POST" },
  );
  return res.data;
}

export async function fetchAgentSkills() {
  const res = await request<{ data: import("./types").AgentSkillPublic[] }>(
    "/api/v1/agent/skills",
  );
  return res.data;
}

export async function createSkillRun(
  skillId: string,
  body: {
    sessionId: string;
    prompt: string;
    productAssetId?: string;
    referenceAssetId?: string;
    confirmed?: boolean;
  },
) {
  const res = await request<{ data: import("./types").SkillRun }>(
    `/api/v1/agent/skills/${encodeURIComponent(skillId)}/runs`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
  return res.data;
}

export async function fetchSkillRun(runId: string) {
  const res = await request<{ data: import("./types").SkillRun }>(
    `/api/v1/agent/skills/runs/${encodeURIComponent(runId)}`,
  );
  return res.data;
}

export async function confirmSkillRun(runId: string) {
  const res = await request<{ data: import("./types").SkillRun }>(
    `/api/v1/agent/skills/runs/${encodeURIComponent(runId)}/confirm`,
    { method: "POST" },
  );
  return res.data;
}

export async function cancelSkillRun(runId: string) {
  const res = await request<{ data: import("./types").SkillRun }>(
    `/api/v1/agent/skills/runs/${encodeURIComponent(runId)}/cancel`,
    { method: "POST" },
  );
  return res.data;
}

export async function planDramaProject(body: {
  sessionId: string;
  userIdea: string;
  targetDurationSec?: number;
  aspectRatio?: "9:16" | "16:9";
  planMode?: "single" | "multi_agent";
}) {
  const res = await request<{
    data: {
      project: import("./types").DramaProject;
      estimatedPoints: number;
    };
  }>("/api/v1/drama/runs", {
    method: "POST",
    body: JSON.stringify({ ...body, autoProduce: false }),
  });
  return res.data;
}

export async function analyzeDramaReplicate(videoUrl: string) {
  const res = await request<{
    data: import("./types").DramaReplicateProfile;
  }>("/api/v1/drama/replicate/analyze", {
    method: "POST",
    body: JSON.stringify({ videoUrl }),
  });
  return res.data;
}

export async function createDramaPlanRun(body: {
  sessionId: string;
  userIdea: string;
  targetDurationSec?: number;
  aspectRatio?: "9:16" | "16:9";
  autoProduce?: boolean;
  replicateProfile?: import("./types").DramaReplicateProfile;
  projectType?: import("./types").DramaProjectType;
}) {
  const res = await request<{
    data: import("./types").DramaPlanRun;
  }>("/api/v1/drama/plan/runs", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function fetchDramaPlanRun(runId: string) {
  const res = await request<{
    data: import("./types").DramaPlanRun;
  }>(`/api/v1/drama/plan/runs/${encodeURIComponent(runId)}`);
  return res.data;
}

export async function fetchDramaSessionState(sessionId: string) {
  const res = await request<{
    data: {
      sessionId: string;
      planRun?: import("./types").DramaPlanRun;
      dramaRun?: import("./types").DramaRun;
      draftProject?: import("./types").DramaProject;
    };
  }>(`/api/v1/drama/sessions/${encodeURIComponent(sessionId)}/state`);
  return res.data;
}

export async function rerunDramaPlanRun(
  runId: string,
  body: {
    fromAgent: string;
    projectPatch?: Record<string, unknown>;
  },
) {
  const res = await request<{
    data: import("./types").DramaPlanRun;
  }>(`/api/v1/drama/plan/runs/${encodeURIComponent(runId)}/rerun`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function startDramaProduction(body: {
  sessionId: string;
  projectId: string;
  confirmed?: boolean;
}) {
  const res = await request<{ data: import("./types").DramaRun }>(
    `/api/v1/drama/projects/${encodeURIComponent(body.projectId)}/produce`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
  return res.data;
}

export async function createDramaRun(body: {
  sessionId: string;
  userIdea: string;
  targetDurationSec?: number;
  aspectRatio?: "9:16" | "16:9";
  confirmed?: boolean;
}) {
  const res = await request<{ data: import("./types").DramaRun }>(
    "/api/v1/drama/runs",
    {
      method: "POST",
      body: JSON.stringify({ ...body, autoProduce: true }),
    },
  );
  return res.data;
}

export async function fetchDramaRun(runId: string) {
  const res = await request<{ data: import("./types").DramaRun }>(
    `/api/v1/drama/runs/${encodeURIComponent(runId)}`,
  );
  return res.data;
}

export async function fetchDramaRunGraph(runId: string) {
  const res = await request<{ data: import("./types").DramaRunGraph }>(
    `/api/v1/drama/runs/${encodeURIComponent(runId)}/graph`,
  );
  return res.data;
}

export async function confirmDramaRun(runId: string) {
  const res = await request<{ data: import("./types").DramaRun }>(
    `/api/v1/drama/runs/${encodeURIComponent(runId)}/confirm`,
    { method: "POST" },
  );
  return res.data;
}

export async function cancelDramaRun(runId: string) {
  const res = await request<{ data: import("./types").DramaRun }>(
    `/api/v1/drama/runs/${encodeURIComponent(runId)}/cancel`,
    { method: "POST" },
  );
  return res.data;
}

export async function retryDramaProduction(
  runId: string,
  fromStep?: string,
) {
  const res = await request<{ data: import("./types").DramaRun }>(
    `/api/v1/drama/runs/${encodeURIComponent(runId)}/retry`,
    {
      method: "POST",
      body: JSON.stringify(fromStep ? { fromStep } : {}),
    },
  );
  return res.data;
}

export async function rerunDramaRunFromNode(
  runId: string,
  nodeId: string,
  projectPatch?: Record<string, unknown>,
) {
  const res = await request<{ data: import("./types").DramaRun }>(
    `/api/v1/drama/runs/${encodeURIComponent(runId)}/nodes/${encodeURIComponent(nodeId)}/rerun`,
    {
      method: "POST",
      body: JSON.stringify(
        projectPatch ? { projectPatch } : {},
      ),
    },
  );
  return res.data;
}

export async function retryDramaShot(
  runId: string,
  shotId: string,
  stage: "keyframe" | "video" = "keyframe",
) {
  const res = await request<{ data: import("./types").DramaRun }>(
    `/api/v1/drama/runs/${encodeURIComponent(runId)}/shots/${encodeURIComponent(shotId)}/retry`,
    {
      method: "POST",
      body: JSON.stringify({ stage }),
    },
  );
  return res.data;
}

export async function pickDramaKeyframe(
  runId: string,
  shotId: string,
  heroIndex: number,
) {
  const res = await request<{ data: import("./types").DramaRun }>(
    `/api/v1/drama/runs/${encodeURIComponent(runId)}/shots/${encodeURIComponent(shotId)}/pick-keyframe`,
    {
      method: "POST",
      body: JSON.stringify({ heroIndex }),
    },
  );
  return res.data;
}

export async function fetchDramaProject(projectId: string) {
  const res = await request<{ data: import("./types").DramaProject }>(
    `/api/v1/drama/projects/${encodeURIComponent(projectId)}`,
  );
  return res.data;
}

export async function generateDramaCharacterTurnaround(
  projectId: string,
  characterId: string,
) {
  const res = await request<{
    data: {
      status: "generating";
      jobIds: string[];
      characterId: string;
      project: import("./types").DramaProject;
    };
  }>(
    `/api/v1/drama/projects/${encodeURIComponent(projectId)}/characters/${encodeURIComponent(characterId)}/turnaround`,
    { method: "POST" },
  );
  return res.data;
}

export async function updateDramaProjectApi(
  projectId: string,
  project: import("./types").DramaProjectPayload,
) {
  const res = await request<{ data: import("./types").DramaProject }>(
    `/api/v1/drama/projects/${encodeURIComponent(projectId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ project }),
    },
  );
  return res.data;
}

export async function estimateDramaPoints(query?: {
  shotCount?: number;
  charCount?: number;
  sceneCount?: number;
  dialogueShots?: number;
  previewTier?: "low" | "full";
}) {
  const params = new URLSearchParams();
  if (query?.shotCount) params.set("shotCount", String(query.shotCount));
  if (query?.charCount) params.set("charCount", String(query.charCount));
  if (query?.sceneCount) params.set("sceneCount", String(query.sceneCount));
  if (query?.dialogueShots) params.set("dialogueShots", String(query.dialogueShots));
  if (query?.previewTier) params.set("previewTier", query.previewTier);
  const res = await request<{ data: { estimatedPoints: number } }>(
    `/api/v1/drama/estimate?${params.toString()}`,
  );
  return res.data.estimatedPoints;
}

export async function estimateDramaProjectPoints(
  project: import("./types").DramaProjectPayload,
) {
  const res = await request<{ data: { estimatedPoints: number } }>(
    "/api/v1/drama/estimate",
    {
      method: "POST",
      body: JSON.stringify({ project }),
    },
  );
  return res.data.estimatedPoints;
}

export async function updateDramaTimeline(projectId: string, timeline: import("./types").DramaTimelineTrack[]) {
  const res = await request<{ data: import("./types").DramaProject }>(
    `/api/v1/drama/projects/${encodeURIComponent(projectId)}/timeline`,
    {
      method: "PATCH",
      body: JSON.stringify({ timeline }),
    },
  );
  return res.data;
}

export async function rerenderDramaRun(runId: string) {
  const res = await request<{ data: import("./types").DramaRun }>(
    `/api/v1/drama/runs/${encodeURIComponent(runId)}/render`,
    {
      method: "POST",
    },
  );
  return res.data;
}

export interface PromptOptimizeContextInput {
  modelId?: string;
  aspectRatio?: string;
  hasReferenceImages?: boolean;
  creationLane?: string;
}

export async function optimizePromptApi(
  prompt: string,
  mode: "chat" | "image" | "ecommerce" = "image",
  options?: { context?: PromptOptimizeContextInput },
) {
  const res = await request<{
    data: { prompt: string; source: "template-mock" | "openai" | "dashscope" };
  }>("/api/v1/prompt/optimize", {
    method: "POST",
    body: JSON.stringify({ prompt, mode, context: options?.context }),
  });
  return res.data;
}

export async function reversePromptFromImage(body: {
  imageUrl?: string;
  assetId?: string;
  sessionId?: string;
}) {
  const res = await request<{
    data: { prompt: string; imageUrl: string; source: string };
  }>("/api/v1/image/prompt-reverse", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function createAssetUploadUrl(input: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sessionId?: string;
}) {
  const res = await request<{
    data: {
      assetId: string;
      uploadUrl: string;
      method: "PUT" | "POST";
      headers?: Record<string, string>;
      expireAt: string;
      fields?: { assetId: string };
    };
  }>("/api/v1/assets/upload-url", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function completeAssetUpload(assetId: string, file: File) {
  const form = new FormData();
  form.append("assetId", assetId);
  form.append("file", file);
  const res = await request<{
    data: {
      id: string;
      url: string;
      thumbUrl?: string;
      mimeType: string;
      sizeBytes: number;
    };
  }>("/api/v1/assets/upload/complete", {
    method: "POST",
    body: form,
  });
  return res.data;
}

export async function uploadAssetViaPresign(file: File, sessionId?: string) {
  const intent = await createAssetUploadUrl({
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    sessionId,
  });

  if (intent.method === "PUT" && intent.headers) {
    const putRes = await fetch(intent.uploadUrl, {
      method: "PUT",
      headers: intent.headers,
      body: file,
    });
    if (!putRes.ok) {
      throw new Error(`直传失败 (${putRes.status})`);
    }
    const confirmed = await request<{
      data: { id: string; url: string; thumbUrl?: string };
    }>("/api/v1/assets/confirm", {
      method: "POST",
      body: JSON.stringify({ assetId: intent.assetId }),
    });
    return {
      id: confirmed.data.id,
      url: confirmed.data.url,
      thumbUrl: confirmed.data.thumbUrl,
      mimeType: file.type,
    };
  }

  return completeAssetUpload(intent.assetId, file);
}

export async function uploadAsset(
  file: File,
  sessionId?: string,
  options?: { lane?: "video" | "default" },
) {
  const form = new FormData();
  form.append("file", file);
  if (sessionId) form.append("sessionId", sessionId);
  if (options?.lane === "video") form.append("lane", "video");
  const res = await request<{
    data: { id: string; url: string; thumbUrl?: string; mimeType: string };
  }>("/api/v1/assets/upload", {
    method: "POST",
    body: form,
  });
  return res.data;
}

export async function registerAssetFromUrl(body: {
  sessionId: string;
  url: string;
  fileName?: string;
}) {
  const res = await request<{
    data: { id: string; url: string; thumbUrl?: string; mimeType: string };
  }>("/api/v1/assets/register-url", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

/** 请求服务端为视频混入 BGM（FFmpeg 服务端合成） */
export async function requestVideoBgmMux(body: {
  sessionId: string;
  videoUrl: string;
  audioAssetId: string;
}): Promise<{ jobId: string; assetId: string; outputUrl: string }> {
  const res = await request<{
    data: { jobId: string; assetId: string; outputUrl: string };
  }>("/api/v1/video/mux-bgm", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}
