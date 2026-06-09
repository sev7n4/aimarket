import type { ImageModel } from "./types";
import { AUTO_MODEL_ID } from "./creation-lane-drafts";

export type VideoAutoMeta = {
  modelId: string;
  provider: string;
  modelName?: string;
};

export function resolveVideoSubmitModelId(
  modelId: string,
  models: ImageModel[],
  videoAuto?: VideoAutoMeta | null,
): string {
  if (modelId !== AUTO_MODEL_ID) return modelId;
  if (videoAuto?.modelId) return videoAuto.modelId;
  return models.find((m) => m.type === "video")?.id ?? modelId;
}

export function videoAutoPickerLabel(
  modelId: string,
  models: ImageModel[],
  videoAuto?: VideoAutoMeta | null,
): string | undefined {
  if (modelId !== AUTO_MODEL_ID) return undefined;
  if (videoAuto?.modelName) return videoAuto.modelName;
  if (videoAuto?.modelId) {
    return models.find((m) => m.id === videoAuto.modelId)?.name;
  }
  return undefined;
}
