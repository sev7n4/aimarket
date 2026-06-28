import { VIDEO_MODEL_IDS } from "../../lib/models.js";
import { getModel } from "../../lib/models.js";
import {
  agnesVideoConfigured,
  agnesVideoProvider,
} from "./agnes.js";
import {
  aliyunWanVideoConfigured,
  aliyunWanVideoProvider,
} from "./aliyun-wan-video.js";
import { httpVideoProvider } from "./http.js";
import {
  klingVideoConfigured,
  klingVideoProvider,
} from "./kling-provider.js";
import { mockVideoProvider } from "./mock.js";
import {
  pixverseVideoConfigured,
  pixverseVideoProvider,
} from "./pixverse-provider.js";
import {
  seedanceVideoConfigured,
  seedanceVideoProvider,
} from "./seedance-provider.js";
import { unavailableVideoProvider } from "./unavailable.js";
import {
  viduVideoConfigured,
  viduVideoProvider,
} from "./vidu-provider.js";
import type { VideoProvider } from "./types.js";
import type { VideoReferenceMode } from "../../lib/video-references.js";

export type VideoReferenceCapability =
  | "full"
  | "image-only"
  | "first-only"
  | "degraded"
  | "none";

export type VideoModelCapabilities = {
  omni: VideoReferenceCapability;
  firstLast: VideoReferenceCapability;
  smartMultiFrame: VideoReferenceCapability;
};

export type VideoRouteProviderName =
  | "agnes-video"
  | "aliyun-wan-video"
  | "http"
  | "kling-video"
  | "mock"
  | "pixverse-video"
  | "seedance-video"
  | "unavailable"
  | "vidu-video";

/** 单模型路由与可用性（供 queryModels / providerStatus / 前端展示） */
export type VideoModelRouteMeta = {
  modelId: string;
  modelName: string;
  provider: VideoRouteProviderName;
  available: boolean;
  /** 实际上游，如 Agnes agnes-video-v2.0、DashScope wan2.7 */
  upstreamLabel: string;
  /** 创作台模型列表补充说明 */
  routingHint?: string;
  unavailableReason?: string;
  capabilities: VideoModelCapabilities;
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

const WAN_CAPABILITIES: VideoModelCapabilities = {
  omni: "full",
  firstLast: "full",
  smartMultiFrame: "full",
};

const AGNES_CAPABILITIES: VideoModelCapabilities = {
  omni: "image-only",
  firstLast: "first-only",
  smartMultiFrame: "degraded",
};

const HTTP_CAPABILITIES: VideoModelCapabilities = {
  omni: "full",
  firstLast: "full",
  smartMultiFrame: "degraded",
};

/** 新模型 Provider 骨架能力（t2v/i2v 基础支持） */
const KLING_CAPABILITIES: VideoModelCapabilities = {
  omni: "image-only",
  firstLast: "first-only",
  smartMultiFrame: "degraded",
};

const SEEDANCE_NATIVE_CAPABILITIES: VideoModelCapabilities = {
  omni: "image-only",
  firstLast: "first-only",
  smartMultiFrame: "degraded",
};

const VIDU_CAPABILITIES: VideoModelCapabilities = {
  omni: "image-only",
  firstLast: "first-only",
  smartMultiFrame: "degraded",
};

const PIXVERSE_CAPABILITIES: VideoModelCapabilities = {
  omni: "image-only",
  firstLast: "first-only",
  smartMultiFrame: "degraded",
};

function capabilitiesForProvider(
  provider: VideoRouteProviderName,
): VideoModelCapabilities {
  switch (provider) {
    case "aliyun-wan-video":
      return WAN_CAPABILITIES;
    case "http":
      return HTTP_CAPABILITIES;
    case "agnes-video":
      return AGNES_CAPABILITIES;
    case "kling-video":
      return KLING_CAPABILITIES;
    case "seedance-video":
      return SEEDANCE_NATIVE_CAPABILITIES;
    case "vidu-video":
      return VIDU_CAPABILITIES;
    case "pixverse-video":
      return PIXVERSE_CAPABILITIES;
    default:
      return { omni: "none", firstLast: "none", smartMultiFrame: "none" };
  }
}

export function capabilityDegradationHint(
  capabilities: VideoModelCapabilities,
  mode: VideoReferenceMode,
): string | undefined {
  if (mode === "omni") {
    if (capabilities.omni === "image-only") return "全能参考将降级为仅首图";
    if (capabilities.omni === "none") return "不支持全能参考";
    return undefined;
  }
  if (mode === "first-last") {
    if (capabilities.firstLast === "first-only") return "首尾帧将降级为仅首帧";
    if (capabilities.firstLast === "none") return "不支持首尾帧";
    return undefined;
  }
  if (mode === "smart-multi-frame") {
    if (capabilities.smartMultiFrame === "degraded") {
      return "智能多帧将合并 prompt + 首图";
    }
    if (capabilities.smartMultiFrame === "none") return "不支持智能多帧";
  }
  return undefined;
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
    capabilities: capabilitiesForProvider("unavailable"),
  };
}

function wanRouteMeta(modelId: string): VideoModelRouteMeta {
  return {
    modelId,
    modelName: getModel(modelId)?.name ?? modelId,
    provider: "aliyun-wan-video",
    available: true,
    upstreamLabel: "DashScope 万相 2.7",
    routingHint: "万相 2.7 原生（t2v/i2v/r2v）",
    capabilities: WAN_CAPABILITIES,
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
    capabilities: AGNES_CAPABILITIES,
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
    capabilities: HTTP_CAPABILITIES,
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
    capabilities: WAN_CAPABILITIES,
  };
}

/** Kling 3.0 原生路由元数据 */
function klingRouteMeta(modelId: string): VideoModelRouteMeta {
  return {
    modelId,
    modelName: getModel(modelId)?.name ?? modelId,
    provider: "kling-video",
    available: true,
    upstreamLabel: "Kling 3.0（快手）",
    routingHint: "Kling 原生（t2v/i2v）",
    capabilities: KLING_CAPABILITIES,
  };
}

/** Seedance 2.0 原生路由元数据 */
function seedanceNativeRouteMeta(modelId: string): VideoModelRouteMeta {
  return {
    modelId,
    modelName: getModel(modelId)?.name ?? modelId,
    provider: "seedance-video",
    available: true,
    upstreamLabel: "Seedance 2.0（字节跳动）",
    routingHint: "Seedance 原生（t2v/i2v）",
    capabilities: SEEDANCE_NATIVE_CAPABILITIES,
  };
}

/** Vidu 原生路由元数据 */
function viduRouteMeta(modelId: string): VideoModelRouteMeta {
  return {
    modelId,
    modelName: getModel(modelId)?.name ?? modelId,
    provider: "vidu-video",
    available: true,
    upstreamLabel: "Vidu（生数科技）",
    routingHint: "Vidu 原生（t2v/i2v）",
    capabilities: VIDU_CAPABILITIES,
  };
}

/** PixVerse 原生路由元数据 */
function pixverseRouteMeta(modelId: string): VideoModelRouteMeta {
  return {
    modelId,
    modelName: getModel(modelId)?.name ?? modelId,
    provider: "pixverse-video",
    available: true,
    upstreamLabel: "PixVerse（爱诗科技）",
    routingHint: "PixVerse 原生（t2v/i2v）",
    capabilities: PIXVERSE_CAPABILITIES,
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

  // auto：HTTP 网关 > 各原生 Provider > Agnes
  if (httpConfigured() && httpVideoProvider.supports(modelId)) {
    return httpRouteMeta(modelId);
  }

  if (
    modelId === "wan-2.6" &&
    aliyunWanVideoConfigured() &&
    aliyunWanVideoProvider.supports(modelId)
  ) {
    return wanRouteMeta(modelId);
  }

  // Kling 3.0 原生
  if (
    modelId === "kling-3.0" &&
    klingVideoConfigured() &&
    klingVideoProvider.supports(modelId)
  ) {
    return klingRouteMeta(modelId);
  }

  // Seedance 2.0 原生
  if (
    modelId === "seedance-2.0" &&
    seedanceVideoConfigured() &&
    seedanceVideoProvider.supports(modelId)
  ) {
    return seedanceNativeRouteMeta(modelId);
  }

  // Vidu 原生
  if (
    modelId === "vidu" &&
    viduVideoConfigured() &&
    viduVideoProvider.supports(modelId)
  ) {
    return viduRouteMeta(modelId);
  }

  // PixVerse 原生
  if (
    modelId === "pixverse" &&
    pixverseVideoConfigured() &&
    pixverseVideoProvider.supports(modelId)
  ) {
    return pixverseRouteMeta(modelId);
  }

  if (agnesVideoConfigured() && agnesVideoProvider.supports(modelId)) {
    return agnesRouteMeta(modelId);
  }

  if (modelId === "wan-2.6") {
    return unavailableMeta(
      modelId,
      "万相视频未接入：请配置 DASHSCOPE_API_KEY 或 VIDEO_API_URL",
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

  if (modelId === "kling-3.0") {
    return unavailableMeta(
      modelId,
      "Kling 3.0 未接入：请配置 KLING_API_KEY 或 VIDEO_API_URL（HTTP 网关）",
    );
  }

  if (modelId === "seedance-2.0") {
    return unavailableMeta(
      modelId,
      "Seedance 2.0 未接入：请配置 SEEDANCE_API_KEY 或 VIDEO_API_URL（HTTP 网关）",
    );
  }

  if (modelId === "vidu") {
    return unavailableMeta(
      modelId,
      "Vidu 未接入：请配置 VIDU_API_KEY 或 VIDEO_API_URL（HTTP 网关）",
    );
  }

  if (modelId === "pixverse") {
    return unavailableMeta(
      modelId,
      "PixVerse 未接入：请配置 PIXVERSE_API_KEY 或 VIDEO_API_URL（HTTP 网关）",
    );
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
    case "aliyun-wan-video":
      return aliyunWanVideoProvider;
    case "http":
      return httpVideoProvider;
    case "kling-video":
      return klingVideoProvider;
    case "seedance-video":
      return seedanceVideoProvider;
    case "vidu-video":
      return viduVideoProvider;
    case "pixverse-video":
      return pixverseVideoProvider;
    case "mock":
      return mockVideoProvider;
    default:
      return unavailableVideoProvider;
  }
}
