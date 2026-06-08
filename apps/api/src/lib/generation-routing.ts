/**
 * 生成路由语义（与内部 legacy slug 解耦）
 *
 * - routingMode：用户/系统选择的调度方式
 * - qualityTier：仅 auto 时区分积分档位（替代 omni-v2 / latest-v2-pro 语义）
 * - legacyModelId：仅用于 Provider 绑定与旧 job 兼容，新写入应同时存 routingMode + qualityTier
 */

export type GenerationRoutingMode = "auto" | "explicit" | "byok";
export type GenerationQualityTier = "standard" | "pro";

export const LEGACY_STANDARD_MODEL_ID = "omni-v2";
export const LEGACY_PRO_MODEL_ID = "latest-v2-pro";

/** @deprecated 新逻辑请用 routingMode + qualityTier；仅读路径与 Provider 绑定 */
export const INTERNAL_ROUTING_MODEL_IDS = new Set([
  LEGACY_STANDARD_MODEL_ID,
  LEGACY_PRO_MODEL_ID,
]);

export function isInternalRoutingModelId(modelId?: string | null): boolean {
  return Boolean(modelId && INTERNAL_ROUTING_MODEL_IDS.has(modelId));
}

export function qualityTierToLegacyModelId(
  tier: GenerationQualityTier,
): string {
  return tier === "pro" ? LEGACY_PRO_MODEL_ID : LEGACY_STANDARD_MODEL_ID;
}

export function legacyModelIdToQualityTier(
  modelId?: string | null,
): GenerationQualityTier | null {
  if (modelId === LEGACY_PRO_MODEL_ID) return "pro";
  if (modelId === LEGACY_STANDARD_MODEL_ID) return "standard";
  return null;
}

export function resolveRoutingModelId(input: {
  routingMode: GenerationRoutingMode;
  qualityTier?: GenerationQualityTier | null;
  explicitModelId?: string | null;
}): string {
  if (input.routingMode === "byok") {
    return input.explicitModelId ?? "dall-e-3";
  }
  if (input.routingMode === "explicit") {
    return input.explicitModelId ?? LEGACY_STANDARD_MODEL_ID;
  }
  return qualityTierToLegacyModelId(input.qualityTier ?? "standard");
}

export function inferRoutingModeFromJob(input: {
  autoRoute?: boolean;
  routingMode?: GenerationRoutingMode;
  modelId?: string | null;
}): GenerationRoutingMode {
  if (input.routingMode) return input.routingMode;
  if (input.autoRoute) return "auto";
  if (input.modelId === "dall-e-3") return "byok";
  if (isInternalRoutingModelId(input.modelId)) return "auto";
  return "explicit";
}
