import { VIDEO_MODEL_IDS } from "../../lib/models.js";
import { getModel } from "../../lib/models.js";
import {
  agnesVideoConfigured,
  agnesVideoProvider,
} from "./agnes.js";
import { httpVideoProvider } from "./http.js";
import { mockVideoProvider } from "./mock.js";
import { unavailableVideoProvider } from "./unavailable.js";
import type { VideoProvider } from "./types.js";

export type VideoRouteProviderName =
  | "agnes-video"
  | "http"
  | "mock"
  | "unavailable";

/** 单模型路由与可用性（供 queryModels / providerStatus / 前端展示） */
export type VideoModelRouteMeta = {
  modelId: string;
  modelName: string;
  provider: VideoRouteProviderName;
  available: boolean;
  /** 实际上游，如 Agnes agnes-video-v2.0、HTTP 网关 */
  upstreamLabel: string;
  /** 创作台模型列表补充说明 */
  routingHint?: string;
  unavailableReason?: string;
};

function agnesApiModel(): string {
  return process.env.AGNES_VIDEO_MODEL?.trim() || "agnes-video-v2.0";
}

function videoProviderMode(): string {
  return process.env.VIDEO_PROVIDER?.trim() || "auto";
}

function httpConfigured(): boolean {
  return Boolean(process.env.VIDEO_API_URL?.trim());
}

function unavailableMeta(
  modelId: string,
  reason: string,
): VideoModelRouteMeta {
  return {
    modelId,
    modelName: getModel(modelId)?.name ?? modelId,
    provider: "unavailable",
    available: false,
    upstreamLabel: "—",
    unavailableReason: reason,
  };
}

function agnesRouteMeta(modelId: string): VideoModelRouteMeta {
  const routingHint =
    modelId === "seedance-2"
      ? "经 Agnes 代理（非字节 Seedance API）"
      : undefined;
  return {
    modelId,
    modelName: getModel(modelId)?.name ?? modelId,
    provider: "agnes-video",
    available: true,
    upstreamLabel: `Agnes ${agnesApiModel()}`,
    routingHint,
  };
}

function httpRouteMeta(modelId: string): VideoModelRouteMeta {
  const routingHint =
    modelId === "seedance-2"
      ? "HTTP 网关 · Seedance"
      : modelId === "wan-2.6"
        ? "HTTP 网关 · 万相"
        : undefined;
  return {
    modelId,
    modelName: getModel(modelId)?.name ?? modelId,
    provider: "http",
    available: true,
    upstreamLabel: "HTTP 视频网关",
    routingHint,
  };
}

function mockRouteMeta(modelId: string): VideoModelRouteMeta {
  return {
    modelId,
    modelName: getModel(modelId)?.name ?? modelId,
    provider: "mock",
    available: true,
    upstreamLabel: "Mock 占位（仅开发/测试）",
    routingHint: "Mock 占位视频",
  };
}

/** 解析单模型路由（不发起网络请求） */
export function resolveVideoModelRoute(modelId: string): VideoModelRouteMeta {
  const mode = videoProviderMode();

  if (mode === "mock") {
    return mockRouteMeta(modelId);
  }

  if (mode === "http") {
    if (httpConfigured() && httpVideoProvider.supports(modelId)) {
      return httpRouteMeta(modelId);
    }
    return unavailableMeta(
      modelId,
      "VIDEO_PROVIDER=http 但未配置 VIDEO_API_URL，或该模型不支持 HTTP 网关",
    );
  }

  if (mode === "agnes") {
    if (agnesVideoConfigured() && agnesVideoProvider.supports(modelId)) {
      return agnesRouteMeta(modelId);
    }
    return unavailableMeta(
      modelId,
      "VIDEO_PROVIDER=agnes 但 AGNES_API_KEY 未配置，或该模型不走 Agnes",
    );
  }

  // auto：HTTP 网关优先（seedance / wan），再 Agnes 别名，禁止 wan 静默 Mock
  if (httpConfigured() && httpVideoProvider.supports(modelId)) {
    return httpRouteMeta(modelId);
  }

  if (agnesVideoConfigured() && agnesVideoProvider.supports(modelId)) {
    return agnesRouteMeta(modelId);
  }

  if (modelId === "wan-2.6") {
    return unavailableMeta(
      modelId,
      "万相视频未接入：请配置 VIDEO_API_URL 对接万相/自建网关，或等待 wan-video 能力上线",
    );
  }

  if (modelId === "seedance-2") {
    return unavailableMeta(
      modelId,
      "Seedance 视频未接入：请配置 AGNES_API_KEY（Agnes 代理）或 VIDEO_API_URL（HTTP 网关）",
    );
  }

  if (modelId === "agnes-video") {
    return unavailableMeta(modelId, "Agnes Video 未配置：请设置 AGNES_API_KEY");
  }

  return unavailableMeta(modelId, `视频模型 ${modelId} 不可用`);
}

export function getVideoModelRoutes(): VideoModelRouteMeta[] {
  return VIDEO_MODEL_IDS.map((id) => resolveVideoModelRoute(id));
}

export function resolveVideoProvider(modelId: string): VideoProvider {
  const route = resolveVideoModelRoute(modelId);
  switch (route.provider) {
    case "agnes-video":
      return agnesVideoProvider;
    case "http":
      return httpVideoProvider;
    case "mock":
      return mockVideoProvider;
    default:
      return unavailableVideoProvider;
  }
}
