import type { DramaStoryboardShot } from "@/lib/types";

export function sortDramaShots(
  shots: DramaStoryboardShot[],
): DramaStoryboardShot[] {
  return [...shots].sort((a, b) => a.order - b.order);
}

export function reorderDramaShots(
  shots: DramaStoryboardShot[],
  fromIndex: number,
  toIndex: number,
): DramaStoryboardShot[] {
  const sorted = sortDramaShots(shots);
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= sorted.length ||
    toIndex >= sorted.length ||
    fromIndex === toIndex
  ) {
    return sorted;
  }
  const next = [...sorted];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next.map((shot, order) => ({ ...shot, order }));
}

export function createDramaShot(
  shots: DramaStoryboardShot[],
): DramaStoryboardShot {
  const sorted = sortDramaShots(shots);
  const last = sorted[sorted.length - 1];
  return {
    id: `shot_${Date.now()}`,
    order: shots.length,
    sceneId: last?.sceneId ?? shots[0]?.sceneId ?? "",
    characterIds: last?.characterIds ?? shots[0]?.characterIds ?? [],
    dialogue: [],
    visualPrompt: "新镜头画面描述",
    motionPrompt: "轻微运镜",
    cameraSpec: { shotSize: "MS", movement: "固定", lighting: "自然光" },
    durationSec: 5,
    useLastFrameContinuity: false,
    status: "pending",
  };
}

export function shotThumbnailUrl(
  shot: DramaStoryboardShot,
): string | undefined {
  if (shot.keyframeUrl) return shot.keyframeUrl;
  if (shot.videoUrl) return shot.videoUrl;
  const hero = shot.keyframeHeroIndex ?? 0;
  return shot.keyframeVariantUrls?.[hero];
}

export function shotDialogueLine(shot: DramaStoryboardShot): string {
  return shot.dialogue[0]?.line?.trim() ?? "";
}
