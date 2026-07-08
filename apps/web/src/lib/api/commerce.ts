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

export type CommerceHeroSource =
  | "ecommerce_set"
  | "commerce_promo_cutout"
  | "commerce_promo_upscale";


export interface CommerceHeroCandidate {
  outputId: string;
  url: string;
  source: CommerceHeroSource;
  skillRunId: string;
  skillId: string;
  stepId: string;
  label: string;
}


export async function listSessionCommerceHeroes(sessionId: string) {
  const res = await request<{ data: CommerceHeroCandidate[] }>(
    `/api/v1/drama/sessions/${encodeURIComponent(sessionId)}/commerce-heroes`,
  );
  return res.data;
}


export async function bindDramaShotCommerceHero(
  projectId: string,
  shotId: string,
  outputId: string,
  source: CommerceHeroSource,
) {
  const res = await request<{ data: import("../types").DramaProject }>(
    `/api/v1/drama/projects/${encodeURIComponent(projectId)}/shots/${encodeURIComponent(shotId)}/bind-commerce-hero`,
    {
      method: "POST",
      body: JSON.stringify({ outputId, source }),
    },
  );
  return res.data;
}


export async function unbindDramaShotCommerceHero(
  projectId: string,
  shotId: string,
) {
  const res = await request<{ data: import("../types").DramaProject }>(
    `/api/v1/drama/projects/${encodeURIComponent(projectId)}/shots/${encodeURIComponent(shotId)}/bind-commerce-hero`,
    {
      method: "DELETE",
    },
  );
  return res.data;
}

// ============ PROD-D03 — Skill / 模板市场 ============

