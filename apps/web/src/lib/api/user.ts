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

