import {
  LEGACY_STANDARD_MODEL_ID,
  type GenerationRoutingMode,
} from "../generation-routing.js";
import { USER_SELECTED_IMAGE_MODEL_IDS } from "../image-routing.js";
import type { DramaProjectData } from "./schema.js";

/**
 * 短剧图像步默认 Auto 路由（Agnes → 万相 → Seedream）。
 * 勿用 `agnes-image` 作为 pipeline 默认：该 id 被视为用户显式选型，不会跨 Provider 回落。
 */
export const DRAMA_DEFAULT_IMAGE_MODEL_ID = LEGACY_STANDARD_MODEL_ID;

const LEGACY_PINNED_AGNES = "agnes-image";

export function resolveDramaImageModelId(
  project: Pick<DramaProjectData, "productionParams"> | undefined,
): string {
  const id = project?.productionParams?.imageModelId?.trim();
  if (!id || id === LEGACY_PINNED_AGNES) {
    return DRAMA_DEFAULT_IMAGE_MODEL_ID;
  }
  return id;
}

export function resolveDramaImageJobRouting(modelId: string): {
  modelId: string;
  routingMode: GenerationRoutingMode;
  autoRoute: boolean;
} {
  const useAuto =
    modelId === DRAMA_DEFAULT_IMAGE_MODEL_ID ||
    modelId === LEGACY_PINNED_AGNES ||
    !USER_SELECTED_IMAGE_MODEL_IDS.has(modelId);

  if (useAuto) {
    return {
      modelId: DRAMA_DEFAULT_IMAGE_MODEL_ID,
      routingMode: "auto",
      autoRoute: true,
    };
  }

  return {
    modelId,
    routingMode: "explicit",
    autoRoute: false,
  };
}

export function dramaImageGenerationJobParams(
  project: Pick<DramaProjectData, "productionParams"> | undefined,
): ReturnType<typeof resolveDramaImageJobRouting> {
  return resolveDramaImageJobRouting(resolveDramaImageModelId(project));
}
