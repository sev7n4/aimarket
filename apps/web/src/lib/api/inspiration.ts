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
  dramaTemplate?: import("../types").DramaTemplateMetadata;
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
      dramaTemplate: import("../types").DramaTemplateMetadata;
      inspiration: { id: string; title: string; coverUrl: string; category: string };
    };
  }>(`/api/v1/inspiration/${encodeURIComponent(id)}/copy-to-session`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
  return res.data;
}

