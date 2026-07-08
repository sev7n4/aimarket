import { request, getToken, setToken, assetUrl, API_BASE } from "./core";
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

