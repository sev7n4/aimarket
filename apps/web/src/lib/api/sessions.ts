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
  dramaTemplate?: import("../types").DramaTemplateMetadata;
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


export async function exportSession(sessionId: string) {
  const res = await request<{
    data: { sessionId: string; title: string; files: { url: string }[]; count: number };
  }>(`/api/v1/imageSession/${sessionId}/export`);
  return res.data;
}

