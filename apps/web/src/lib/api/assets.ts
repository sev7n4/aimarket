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

// ============ 1.2 画布节点式 Flow API 已于 Phase 5.1 移除 ============
// Phase 5.1 之后 Web 端使用 DesignCanvas + InfiniteCanvas，不再调用 xyflow flow API。
// 服务端路由保留（用于 MCP / 外部客户端），前端不再 import。
// ============ 12.2 画布模板 API 已于 Phase 5.1 移除 ============
// Phase 5.1 之后 InfiniteCanvas 自带 TemplateManager，不再调用旧模板 API。

// ── Phase 4 Task 4.3 — 工作流模板（drama/templates） ──

