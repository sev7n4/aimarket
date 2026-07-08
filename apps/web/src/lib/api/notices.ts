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

