import type { DramaProjectData } from "./schema.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeEntityArray<T extends { id: string }>(
  current: T[],
  patch: unknown,
): T[] | undefined {
  if (!Array.isArray(patch)) return undefined;
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const raw of patch) {
    if (!isPlainObject(raw) || typeof raw.id !== "string") continue;
    const prev = byId.get(raw.id);
    byId.set(raw.id, prev ? { ...prev, ...raw } : (raw as T));
  }
  return Array.from(byId.values());
}

/** 深合并短剧 project patch（script / shots 等局部更新不覆盖未提及字段） */
export function mergeDramaProjectPatch(
  current: DramaProjectData,
  patch: Record<string, unknown>,
): DramaProjectData {
  const next: DramaProjectData = {
    ...current,
    ...(patch as Partial<DramaProjectData>),
  };

  if (isPlainObject(patch.script)) {
    next.script = { ...current.script, ...patch.script };
  }
  if (isPlainObject(patch.styleBible)) {
    next.styleBible = { ...current.styleBible, ...patch.styleBible };
  }
  if (isPlainObject(patch.productionParams) && current.productionParams) {
    next.productionParams = {
      ...current.productionParams,
      ...patch.productionParams,
    };
  } else if (isPlainObject(patch.productionParams)) {
    next.productionParams = {
      aspectRatio: "9:16",
      imageModelId: "omni-v2",
      videoModelId: "wan-2.6",
      resolution: "1k",
      previewTier: "full",
      ...patch.productionParams,
    };
  }

  const mergedShots = mergeEntityArray(current.shots, patch.shots);
  if (mergedShots) next.shots = mergedShots;

  const mergedCharacters = mergeEntityArray(current.characters, patch.characters);
  if (mergedCharacters) next.characters = mergedCharacters;

  const mergedScenes = mergeEntityArray(current.scenes, patch.scenes);
  if (mergedScenes) next.scenes = mergedScenes;

  return next;
}
