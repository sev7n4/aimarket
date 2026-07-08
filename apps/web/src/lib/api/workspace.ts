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
