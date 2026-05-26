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
  Notice,
  ProductSetInit,
  RouteSuggestion,
  SessionAccessMeta,
  SessionReference,
  SignStatus,
  StudioTool,
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
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
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
      inviteBonus?: { reward: number; message: string } | null;
    };
  }>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, inviteCode }),
    auth: false,
  });
  setToken(res.data.token);
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

export async function ensureSession(
  sessionId: string,
  mode: string,
  options?: {
    title?: string;
    kind?: "canvas" | "project";
    workspaceId?: string;
  },
) {
  const res = await request<{ data: ImageSession }>(
    "/api/v1/imageSession/ensure",
    {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        mode,
        title: options?.title,
        kind: options?.kind,
        workspaceId: options?.workspaceId,
      }),
    },
  );
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
    x: number;
    y: number;
    width: number;
    height: number;
    label?: string;
    isVideo?: boolean;
    source?: "upload" | "generation";
  }[];
}

export async function fetchCanvasLayout(sessionId: string) {
  const res = await request<{ data: CanvasLayoutDto }>(
    `/api/v1/imageSession/${sessionId}/canvas`,
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
  const res = await request<{ data: ImageModel[] }>("/api/v1/ai/queryModels");
  return res.data;
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

export async function suggestModel(mode: string, prompt: string) {
  const res = await request<{ data: RouteSuggestion }>(
    "/api/v1/ai/suggestModel",
    {
      method: "POST",
      body: JSON.stringify({ mode, prompt }),
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
}) {
  const res = await request<{
    data: {
      jobId: string;
      estimatedPoints: number;
      status: string;
      modelId?: string;
      routeReason?: string;
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
    data: {
      mode: string;
      openaiConfigured: boolean;
      activeProvider: string;
      usingMock?: boolean;
      hint?: string;
      openaiBaseUrl?: string;
      openaiImageModel?: string;
    };
  }>("/api/v1/ai/providerStatus");
  return res.data;
}

export async function submitVideoGeneration(body: {
  sessionId: string;
  prompt: string;
  modelId: string;
  count?: number;
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

export async function runTool(
  toolId: string,
  body: {
    sessionId: string;
    prompt?: string;
    resolution?: string;
    referenceOutputIds?: string[];
    assetIds?: string[];
    scale?: "2x" | "4x";
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
}) {
  const params = new URLSearchParams();
  if (opts?.pageNum) params.set("pageNum", String(opts.pageNum));
  if (opts?.pageSize) params.set("pageSize", String(opts.pageSize));
  if (opts?.category && opts.category !== "全部") {
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

export async function optimizePromptApi(
  prompt: string,
  mode: "chat" | "quick" | "ecommerce" = "chat",
) {
  const res = await request<{ data: { prompt: string } }>(
    "/api/v1/prompt/optimize",
    {
      method: "POST",
      body: JSON.stringify({ prompt, mode }),
    },
  );
  return res.data.prompt;
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
    data: { id: string; url: string; mimeType: string; sizeBytes: number };
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
      data: { id: string; url: string };
    }>("/api/v1/assets/confirm", {
      method: "POST",
      body: JSON.stringify({ assetId: intent.assetId }),
    });
    return {
      id: confirmed.data.id,
      url: confirmed.data.url,
      mimeType: file.type,
    };
  }

  return completeAssetUpload(intent.assetId, file);
}

export async function uploadAsset(file: File, sessionId?: string) {
  const form = new FormData();
  form.append("file", file);
  if (sessionId) form.append("sessionId", sessionId);
  const res = await request<{
    data: { id: string; url: string; mimeType: string };
  }>("/api/v1/assets/upload", {
    method: "POST",
    body: form,
  });
  return res.data;
}
