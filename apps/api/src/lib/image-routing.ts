/**
 * 图像模型 → Provider 路由（文生图 / 图生图 / edit / variation）
 *
 * 扩展新接入：在 MODEL_GENERATE_BINDINGS 增加一行，并实现对应 ImageProvider。
 */
import { AppError } from "./errors.js";
import { aliyunWanProvider } from "../providers/aliyun-wan.js";
import { mockProvider } from "../providers/mock.js";
import { openaiProvider } from "../providers/openai.js";
import { seedreamImageProvider } from "../providers/seedream-image.js";
import { seededitProvider } from "../providers/seededit-provider.js";
import type { ImageOperation, ImageProvider } from "../providers/types.js";

export interface ImageRouteContext {
  hasReferenceImages?: boolean;
}

/** 模型在 generate 操作下可用的 Provider 绑定（可扩展） */
export const MODEL_GENERATE_BINDINGS: ReadonlyArray<{
  modelId: string;
  providerName: string;
  t2i: boolean;
  i2i: boolean;
}> = [
  { modelId: "omni-v2", providerName: "aliyun-wan", t2i: true, i2i: false },
  { modelId: "omni-v2", providerName: "seedream-image", t2i: true, i2i: true },
  { modelId: "latest-v2-pro", providerName: "aliyun-wan", t2i: true, i2i: false },
  { modelId: "latest-v2-pro", providerName: "seedream-image", t2i: true, i2i: true },
  { modelId: "seedream-5", providerName: "seedream-image", t2i: true, i2i: true },
  { modelId: "seedream-4", providerName: "seedream-image", t2i: true, i2i: true },
  { modelId: "dall-e-2", providerName: "openai", t2i: true, i2i: false },
  { modelId: "dall-e-3", providerName: "openai", t2i: true, i2i: false },
];

const ALL_PROVIDERS: ImageProvider[] = [
  seededitProvider,
  seedreamImageProvider,
  aliyunWanProvider,
  openaiProvider,
  mockProvider,
];

const I2I_FALLBACK_ORDER = ["seedream-image", "aliyun-wan"] as const;

function providerByName(name: string): ImageProvider | undefined {
  return ALL_PROVIDERS.find((p) => p.name === name);
}

export function aliyunWanI2iConfigured(): boolean {
  return Boolean(process.env.ALIYUN_WAN_I2I_MODEL?.trim());
}

function providerCanI2i(provider: ImageProvider, modelId: string): boolean {
  if (!provider.supports(modelId, "generate")) return false;
  if (provider.name === "seedream-image") {
    return Boolean(process.env.ARK_API_KEY?.trim());
  }
  if (provider.name === "aliyun-wan") {
    return aliyunWanI2iConfigured();
  }
  return false;
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

function orderedGenerateCandidates(
  modelId: string,
  hasRefs: boolean,
): ImageProvider[] {
  const mode = hasRefs ? "i2i" : "t2i";
  const seen = new Set<string>();
  const out: ImageProvider[] = [];

  const push = (provider: ImageProvider | undefined) => {
    if (!provider || seen.has(provider.name)) return;
    if (!provider.supports(modelId, "generate")) return;
    if (hasRefs && !providerCanI2i(provider, modelId)) return;
    seen.add(provider.name);
    out.push(provider);
  };

  for (const binding of bindingsFor(modelId, mode)) {
    push(providerByName(binding.providerName));
  }

  if (hasRefs) {
    for (const name of I2I_FALLBACK_ORDER) {
      push(providerByName(name));
    }
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
): ImageProvider | undefined {
  const mode = process.env.IMAGE_PROVIDER ?? "auto";

  if (mode === "mock") return mockProvider;

  if (mode === "openai") {
    const openai = candidates.find((p) => p.name === "openai");
    return openai?.supports(modelId, operation) ? openai : undefined;
  }

  if (mode === "aliyun_wan") {
    // 文生图：优先万相；图生图 / 显式 Seedream 模型：允许回落到已配置的 i2i Provider
    if (modelId.startsWith("seedream")) {
      return (
        candidates.find((p) => p.name === "seedream-image") ??
        candidates.find((p) => p.name !== "mock")
      );
    }
    if (hasRefs && operation === "generate") {
      return (
        candidates.find((p) => providerCanI2i(p, modelId)) ??
        candidates.find((p) => p.name !== "mock")
      );
    }
    return (
      candidates.find((p) => p.name === "aliyun-wan") ??
      candidates.find((p) => p.name !== "mock")
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
    const candidates = orderedGenerateCandidates(modelId, hasRefs);
    const picked = pickWithEnvMode(candidates, modelId, operation, hasRefs);
    if (picked) return picked;

    const detail =
      hasRefs ?
        "当前无可用图生图 Provider（请配置 ARK_API_KEY 或 ALIYUN_WAN_I2I_MODEL）"
      : "当前无可用文生图 Provider";
    throw new AppError(400, "MODEL_UNSUPPORTED", `模型 ${modelId}：${detail}`);
  }

  const candidates = ALL_PROVIDERS.filter((p) => p.supports(modelId, operation));
  const picked = pickWithEnvMode(candidates, modelId, operation, hasRefs);
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
