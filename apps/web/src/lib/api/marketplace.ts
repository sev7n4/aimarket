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

export interface MarketplaceSkill {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  authorId: string;
  skillYaml: string;
  version: number;
  status: "pending_review" | "published" | "rejected" | "archived";
  installCount: number;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}


export async function fetchMarketplaceSkills(opts?: {
  pageNum?: number;
  pageSize?: number;
  category?: string;
}) {
  const params = new URLSearchParams();
  if (opts?.pageNum) params.set("pageNum", String(opts.pageNum));
  if (opts?.pageSize) params.set("pageSize", String(opts.pageSize));
  if (opts?.category) params.set("category", opts.category);
  const qs = params.toString();
  const res = await request<{ data: MarketplaceSkill[]; total: number }>(
    `/api/v1/marketplace/skills${qs ? `?${qs}` : ""}`,
  );
  return res;
}


export async function fetchMarketplaceSkill(slug: string) {
  const res = await request<{ data: MarketplaceSkill }>(
    `/api/v1/marketplace/skills/${encodeURIComponent(slug)}`,
  );
  return res.data;
}


export async function installMarketplaceSkill(slug: string) {
  const res = await request<{ data: MarketplaceSkill }>(
    `/api/v1/marketplace/skills/${encodeURIComponent(slug)}/install`,
    { method: "POST" },
  );
  return res.data;
}


export async function fetchMyMarketplaceSkills() {
  const res = await request<{ data: MarketplaceSkill[] }>(
    `/api/v1/marketplace/my/skills`,
  );
  return res.data;
}


export async function publishMarketplaceSkill(body: {
  name: string;
  description?: string;
  category?: string;
  skillYaml: string;
}) {
  const res = await request<{ data: MarketplaceSkill }>(
    `/api/v1/marketplace/skills`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
  return res.data;
}

