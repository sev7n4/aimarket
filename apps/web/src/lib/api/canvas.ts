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

export interface CanvasLayoutConnectionDto {
  id: string;
  fromNodeId: string;
  toNodeId: string;
}


export interface CanvasLayoutDto {
  version: 1;
  infiniteConnections?: CanvasLayoutConnectionDto[];
  dramaNodePositions?: Record<string, { x: number; y: number }>;
  items: {
    id: string;
    url: string;
    thumbUrl?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    label?: string;
    isVideo?: boolean;
    source?: "upload" | "generation";
    role?: "reference" | "product" | "output";
    assetId?: string;
    outputId?: string;
    batchId?: string;
    batchIndex?: number;
    batchTitle?: string;
    batchSubtitle?: string;
    parentBatchId?: string;
    sourceItemId?: string;
  }[];
}


export async function fetchCanvasLayout(sessionId: string) {
  const res = await request<{ data: CanvasLayoutDto }>(
    `/api/v1/imageSession/${sessionId}/canvas`,
  );
  return res.data;
}


export interface CanvasBundleDto {
  layout: CanvasLayoutDto;
  messages: ChatMessage[];
  meta?: SessionAccessMeta;
}


export async function fetchCanvasBundle(sessionId: string) {
  const res = await request<{ data: CanvasBundleDto }>(
    `/api/v1/imageSession/${sessionId}/canvas-bundle`,
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

