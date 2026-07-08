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

export async function fetchModels() {
  const res = await request<{
    data: ImageModel[];
    meta?: {
      videoAuto?: {
        modelId: string;
        provider: string;
        modelName?: string;
        routingHint?: string;
        upstreamLabel?: string;
      };
      videoRoutes?: VideoModelRouteMeta[];
    };
  }>("/api/v1/ai/queryModels");
  videoAutoMeta = res.meta?.videoAuto ?? null;
  videoRoutesMeta = res.meta?.videoRoutes ?? [];
  return res.data;
}

let videoAutoMeta: {
  modelId: string;
  provider: string;
  modelName?: string;
  routingHint?: string;
  upstreamLabel?: string;
} | null = null;

let videoRoutesMeta: VideoModelRouteMeta[] = [];

/** 视频车道 Auto 实际使用的 modelId（来自 queryModels meta） */

export function getVideoAutoModelMeta() {
  return videoAutoMeta;
}

/** 各视频模型路由与可用性（来自 queryModels meta） */

export function getVideoModelRoutesMeta(): VideoModelRouteMeta[] {
  return videoRoutesMeta;
}


export function getVideoModelRoute(modelId: string): VideoModelRouteMeta | undefined {
  return videoRoutesMeta.find((r) => r.modelId === modelId);
}


export async function estimatePoints(
  modelId: string,
  count: number,
  resolution: string,
) {
  const res = await request<{ data: { totalPoints: number } }>(
    "/api/v1/ai/estimatePointsBatch",
    {
      method: "POST",
      body: JSON.stringify({
        items: [{ modelId, count, resolution }],
      }),
    },
  );
  return res.data.totalPoints;
}


export async function suggestModel(
  mode: string,
  prompt: string,
  hasReferenceImages?: boolean,
) {
  const res = await request<{ data: RouteSuggestion }>(
    "/api/v1/ai/suggestModel",
    {
      method: "POST",
      body: JSON.stringify({ mode, prompt, hasReferenceImages }),
    },
  );
  return res.data;
}


export async function fetchReferences(sessionId: string) {
  const res = await request<{ data: SessionReference[] }>(
    `/api/v1/imageSession/${sessionId}/references`,
  );
  return res.data;
}


export async function fetchProductSetInit() {
  const res = await request<{ data: ProductSetInit }>(
    "/api/v1/productSet/init",
    { auth: false },
  );
  return res.data;
}


export async function submitGeneration(body: {
  sessionId: string;
  prompt: string;
  modelId?: string;
  count: number;
  resolution: string;
  aspectRatio?: string;
  mode: string;
  assetIds?: string[];
  referenceOutputIds?: string[];
  autoRoute?: boolean;
  toolContext?: {
    toolId: string;
    masks: Array<{
      itemId: string;
      mode: "brush" | "box";
      maskDataUrl: string;
      bbox: { x: number; y: number; width: number; height: number };
      normalizedBbox: { x: number; y: number; width: number; height: number };
    }>;
  };
  parentJobId?: string;
  sourceOutputId?: string;
  sourceLane?: "agent" | "image" | "video";
}) {
  const res = await request<{
    data: {
      jobId: string;
      estimatedPoints: number;
      status: string;
      modelId?: string;
      routingMode?: "auto" | "explicit" | "byok";
      qualityTier?: "standard" | "pro";
      routeReason?: string;
      byokActive?: boolean;
    };
  }>("/api/v1/ai/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}


export async function submitEcommerceGenerate(body: {
  sessionId: string;
  brand?: string;
  platform: string;
  market: string;
  language: string;
  productInfo: string;
  designer?: string;
  modelId?: string;
  resolution?: string;
  productAssetId?: string;
  referenceAssetId?: string;
  parentJobId?: string;
  sourceOutputId?: string;
}) {
  const res = await request<{
    data: {
      jobId: string;
      estimatedPoints: number;
      modelId: string;
      routeReason: string;
      slideCount: number;
    };
  }>("/api/v1/productSet/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}


export async function submitEcommerceRerunSlide(body: {
  sessionId: string;
  slideKey: "main" | "selling" | "scene" | "detail";
  brand?: string;
  platform: string;
  market: string;
  language: string;
  productInfo: string;
  designer?: string;
  modelId?: string;
  resolution?: string;
  productAssetId?: string;
  referenceAssetId?: string;
  parentJobId?: string;
  sourceOutputId?: string;
}) {
  const res = await request<{
    data: {
      jobId: string;
      estimatedPoints: number;
      modelId: string;
      routeReason: string;
      slideKey: "main" | "selling" | "scene" | "detail";
      slideLabel: string;
    };
  }>("/api/v1/productSet/rerun-slide", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}


export async function submitVideoGeneration(body: {
  sessionId: string;
  prompt: string;
  modelId: string;
  count?: number;
  resolution?: string;
  aspectRatio?: string;
  videoResolution?: import("../creation-dock-prefs").VideoResolution;
  parentJobId?: string;
  sourceOutputId?: string;
  referenceMode?: import("../creation-dock-prefs").VideoReferenceMode;
  durationSec?: import("../creation-dock-prefs").VideoDurationSec;
  videoReferences?: import("../creation-dock-prefs").VideoMediaRef[];
  smartMultiShots?: import("../creation-dock-prefs").SmartMultiShot[];
  assetIds?: string[];
  referenceOutputIds?: string[];
  sourceLane?: import("../creation-dock-prefs").CreationLane;
}) {
  const res = await request<{
    data: { jobId: string; estimatedPoints: number };
  }>("/api/v1/ai/generate/video", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}


export async function recognizeFocusPoint(body: {
  sessionId: string;
  imageUrl?: string;
  imageBase64?: string;
  x?: number;
  y?: number;
  cropSize?: number;
}) {
  const res = await request<{
    data: { pointId: string; objectName: string; provider: string };
  }>("/api/v1/focus/point", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}


export async function runTool(
  toolId: string,
  body: {
    sessionId: string;
    prompt?: string;
    resolution?: string;
    aspectRatio?: string;
    count?: number;
    referenceOutputIds?: string[];
    assetIds?: string[];
    scale?: "2x" | "4x";
    intent?: "edit" | "replace";
    extend?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
      direction?: "all" | "left" | "right" | "up" | "down";
    };
    focusPoints?: Array<{
      pointId: string;
      objectName: string;
      x?: number;
      y?: number;
    }>;
    toolContext?: {
      toolId: string;
      masks?: Array<{
        itemId: string;
        mode: "brush" | "box";
        maskDataUrl: string;
        bbox: { x: number; y: number; width: number; height: number };
        normalizedBbox: { x: number; y: number; width: number; height: number };
      }>;
      sources?: Array<{
        id?: string;
        x?: number;
        y?: number;
        colorTemp?: "warm" | "neutral" | "cool";
        intensity?: number;
        type?: "point" | "area" | "spotlight";
      }>;
      camera?: {
        shotSize?: string;
        movement?: string;
        pitch?: number;
        yaw?: number;
      };
    };
  },
) {
  const res = await request<{
    data: { jobId: string; estimatedPoints: number; tool: string };
  }>(`/api/v1/tools/${toolId}/run`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}


export async function fetchJob(jobId: string) {
  const res = await request<{ data: GenerationJob }>(`/api/v1/ai/jobs/${jobId}`);
  return res.data;
}


export async function cancelJob(jobId: string) {
  const res = await request<{
    data: { status: string; refundedPoints: number };
  }>(`/api/v1/ai/jobs/${jobId}/cancel`, {
    method: "POST",
  });
  return res.data;
}


export interface PromptOptimizeContextInput {
  modelId?: string;
  aspectRatio?: string;
  hasReferenceImages?: boolean;
  creationLane?: string;
  /** 前端 resolveIntent 推断的主意图信号，如 "image-edit" */
  intentSignal?: string;
  /** 意图推断置信度 0-1 */
  intentConfidence?: number;
  /** 用户近期采纳的润色结果，作为个性化风格 few-shot 参考 */
  recentAccepted?: string[];
}


export async function optimizePromptApi(
  prompt: string,
  mode: "chat" | "image" | "ecommerce" = "image",
  options?: { context?: PromptOptimizeContextInput },
) {
  const res = await request<{
    data: {
      prompt: string;
      source: "template-mock" | "openai" | "dashscope";
      direction?: string;
      directionLabel?: string;
      variants?: string[];
    };
  }>("/api/v1/prompt/optimize", {
    method: "POST",
    body: JSON.stringify({ prompt, mode, context: options?.context }),
  });
  return res.data;
}


export async function reversePromptFromImage(body: {
  imageUrl?: string;
  assetId?: string;
  sessionId?: string;
}) {
  const res = await request<{
    data: { prompt: string; imageUrl: string; source: string };
  }>("/api/v1/image/prompt-reverse", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}


export async function generateMusic(body: {
  sessionId: string;
  style?: string;
  bpm?: number;
  durationSec?: number;
}) {
  const res = await request<{
    data: { jobId: string; estimatedPoints: number; status: string };
  }>("/api/v1/ai/music", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

