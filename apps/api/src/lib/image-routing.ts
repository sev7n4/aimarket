/**
 * 图像模型 → Provider 路由（文生图 / 图生图 / edit / variation）
 *
 * 扩展新接入：在 MODEL_GENERATE_BINDINGS 增加一行，并实现对应 ImageProvider。
 */
import { AppError } from "./errors.js";
import { userHasByokOpenAi } from "./user-provider-config.js";
import {
  agnesImageConfigured,
  agnesImageProvider,
} from "../providers/agnes-image.js";
import { aliyunWanProvider } from "../providers/aliyun-wan.js";
import { mockProvider } from "../providers/mock.js";
import { openaiProvider } from "../providers/openai.js";
import { seedreamImageProvider } from "../providers/seedream-image.js";
import { seededitProvider } from "../providers/seededit-provider.js";
import type {
  ImageOperation,
  ImageProvider,
  ImageRouteContext,
} from "../providers/types.js";

export type { ImageRouteContext };

/** 模型在 generate 操作下可用的 Provider 绑定（可扩展） */
export const MODEL_GENERATE_BINDINGS: ReadonlyArray<{
  modelId: string;
  providerName: string;
  t2i: boolean;
  i2i: boolean;
}> = [
  // Internal routing aliases kept for Auto mode and legacy job records
  { modelId: "omni-v2", providerName: "agnes-image", t2i: true, i2i: true },
  { modelId: "omni-v2", providerName: "aliyun-wan", t2i: true, i2i: false },
  { modelId: "omni-v2", providerName: "seedream-image", t2i: true, i2i: true },
  { modelId: "latest-v2-pro", providerName: "agnes-image", t2i: true, i2i: true },
  { modelId: "latest-v2-pro", providerName: "aliyun-wan", t2i: true, i2i: false },
  { modelId: "latest-v2-pro", providerName: "seedream-image", t2i: true, i2i: true },
  { modelId: "agnes-image", providerName: "agnes-image", t2i: true, i2i: true },
  // User-facing real models
  { modelId: "seedream-5", providerName: "seedream-image", t2i: true, i2i: true },
  { modelId: "wanxiang-2.6", providerName: "aliyun-wan", t2i: true, i2i: false },
  { modelId: "seedream-4", providerName: "seedream-image", t2i: true, i2i: true },
  { modelId: "dall-e-2", providerName: "openai", t2i: true, i2i: false },
  { modelId: "dall-e-3", providerName: "openai", t2i: true, i2i: false },
];

const ALL_PROVIDERS: ImageProvider[] = [
  seededitProvider,
  seedreamImageProvider,
  agnesImageProvider,
  aliyunWanProvider,
  openaiProvider,
  mockProvider,
];

/** 文生图 / 图生图默认回落顺序：Agnes → 万相 → Seedream */
export function generateFallbackOrder(): readonly string[] {
  return ["agnes-image", "aliyun-wan", "seedream-image"];
}

export function aliyunWanT2iConfigured(): boolean {
  return Boolean(process.env.DASHSCOPE_API_KEY?.trim());
}

function providerByName(name: string): ImageProvider | undefined {
  return ALL_PROVIDERS.find((p) => p.name === name);
}

export function aliyunWanI2iConfigured(): boolean {
  return Boolean(process.env.ALIYUN_WAN_I2I_MODEL?.trim());
}

function providerConfiguredForGenerate(
  provider: ImageProvider,
  modelId: string,
  hasRefs: boolean,
  context: ImageRouteContext = {},
): boolean {
  if (!provider.supports(modelId, "generate", context)) return false;
  if (provider.name === "seedream-image") {
    return Boolean(process.env.ARK_API_KEY?.trim());
  }
  if (provider.name === "aliyun-wan") {
    return hasRefs ? aliyunWanI2iConfigured() : aliyunWanT2iConfigured();
  }
  if (provider.name === "agnes-image") {
    return agnesImageConfigured();
  }
  return true;
}

function bindingsFor(
  modelId: string,
  mode: "t2i" | "i2i",
): typeof MODEL_GENERATE_BINDINGS[number][] {
  return MODEL_GENERATE_BINDINGS.filter((b) => {
    if (b.modelId !== modelId) return false;
    return mode === "i2i" ? b.i2i : b.t2i;
  });
}

/** 用户显式点选的模型（不走跨厂商回落） */
export const USER_SELECTED_IMAGE_MODEL_IDS = new Set([
  "seedream-5",
  "seedream-4",
  "wanxiang-2.6",
  "agnes-image",
  "dall-e-2",
  "dall-e-3",
]);

function orderedExplicitCandidates(
  modelId: string,
  hasRefs: boolean,
  context: ImageRouteContext = {},
): ImageProvider[] {
  const mode = hasRefs ? "i2i" : "t2i";
  const seen = new Set<string>();
  const out: ImageProvider[] = [];

  const push = (provider: ImageProvider | undefined) => {
    if (!provider || seen.has(provider.name)) return;
    if (!providerConfiguredForGenerate(provider, modelId, hasRefs, context)) {
      return;
    }
    seen.add(provider.name);
    out.push(provider);
  };

  for (const binding of bindingsFor(modelId, mode)) {
    push(providerByName(binding.providerName));
  }

  if (out.length === 0) {
    for (const provider of ALL_PROVIDERS) {
      push(provider);
    }
  }

  return out;
}

function orderedAutoRouteCandidates(
  modelId: string,
  hasRefs: boolean,
  context: ImageRouteContext = {},
): ImageProvider[] {
  const mode = hasRefs ? "i2i" : "t2i";
  const seen = new Set<string>();
  const out: ImageProvider[] = [];

  const push = (provider: ImageProvider | undefined) => {
    if (!provider || seen.has(provider.name)) return;
    if (!providerConfiguredForGenerate(provider, modelId, hasRefs, context)) {
      return;
    }
    seen.add(provider.name);
    out.push(provider);
  };

  for (const name of generateFallbackOrder()) {
    push(providerByName(name));
  }

  for (const binding of bindingsFor(modelId, mode)) {
    push(providerByName(binding.providerName));
  }

  for (const provider of ALL_PROVIDERS) {
    push(provider);
  }

  return out;
}

function pickWithEnvMode(
  candidates: ImageProvider[],
  modelId: string,
  operation: ImageOperation,
  hasRefs: boolean,
  context: ImageRouteContext = {},
): ImageProvider | undefined {
  const mode = process.env.IMAGE_PROVIDER ?? "auto";

  if (context.userId && userHasByokOpenAi(context.userId)) {
    const openai = candidates.find((p) => p.name === "openai");
    if (openai?.supports(modelId, operation, context)) return openai;
  }

  if (mode === "mock") return mockProvider;

  if (mode === "openai") {
    const openai = candidates.find((p) => p.name === "openai");
    return openai?.supports(modelId, operation, context) ? openai : undefined;
  }

  if (mode === "agnes" || mode === "aliyun_wan" || mode === "auto") {
    return (
      candidates.find((p) => p.name !== "mock") ?? candidates[0]
    );
  }

  return candidates[0];
}

export function resolveImageProvider(
  modelId: string,
  operation: ImageOperation = "generate",
  context: ImageRouteContext = {},
): ImageProvider {
  const hasRefs = context.hasReferenceImages ?? false;

  if (operation === "generate") {
    const candidates = listGenerateProviderCandidates(modelId, hasRefs, context);
    const picked = pickWithEnvMode(
      candidates,
      modelId,
      operation,
      hasRefs,
      context,
    );
    if (picked) return picked;

    const detail =
      hasRefs ?
        "当前无可用图生图 Provider（请配置 ALIYUN_WAN_I2I_MODEL、AGNES_API_KEY 或 ARK_API_KEY）"
      : "当前无可用文生图 Provider";
    throw new AppError(400, "MODEL_UNSUPPORTED", `模型 ${modelId}：${detail}`);
  }

  const candidates = ALL_PROVIDERS.filter((p) =>
    p.supports(modelId, operation, context),
  );
  const picked = pickWithEnvMode(
    candidates,
    modelId,
    operation,
    hasRefs,
    context,
  );
  if (picked) return picked;

  throw new AppError(
    400,
    "MODEL_UNSUPPORTED",
    `当前模型 ${modelId} 不支持 ${operation} 操作`,
  );
}

export function listRegisteredProviders(): ImageProvider[] {
  return ALL_PROVIDERS;
}

export interface GenerateProviderListOptions {
  /** true = Auto，跨 Provider 回落；false = 用户指定模型，单供应商 */
  allowFallbackChain?: boolean;
}

/** 文生图 / 图生图候选 Provider 列表 */
export function listGenerateProviderCandidates(
  modelId: string,
  hasRefs: boolean,
  context: ImageRouteContext = {},
  options: GenerateProviderListOptions = {},
): ImageProvider[] {
  const allowFallback =
    options.allowFallbackChain ??
    !USER_SELECTED_IMAGE_MODEL_IDS.has(modelId);
  if (allowFallback) {
    return orderedAutoRouteCandidates(modelId, hasRefs, context);
  }
  return orderedExplicitCandidates(modelId, hasRefs, context);
}

export function pickGenerateProvider(
  modelId: string,
  hasRefs: boolean,
  context: ImageRouteContext = {},
): ImageProvider {
  return resolveImageProvider(modelId, "generate", {
    ...context,
    hasReferenceImages: hasRefs,
  });
}
