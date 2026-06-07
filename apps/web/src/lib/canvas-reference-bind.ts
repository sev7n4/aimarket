import type { CanvasItem } from "@/lib/canvas-tools";
import type { CreationLane } from "@/lib/creation-dock-prefs";
import type { ReferenceImageSources } from "@/lib/creation-lane-submit";

export function canAutoBindCanvasItem(
  item: CanvasItem | null | undefined,
  creationLane: CreationLane,
  focusEditActive: boolean,
): boolean {
  if (!item || item.isVideo || focusEditActive) return false;
  if (creationLane !== "image" && creationLane !== "video") return false;
  return Boolean(item.outputId || item.assetId);
}

export function canvasItemToReferenceSlice(
  item: CanvasItem,
): Pick<ReferenceImageSources, "assetIds" | "selectedRefIds"> {
  if (item.outputId) {
    return { assetIds: [], selectedRefIds: [item.outputId] };
  }
  if (item.assetId) {
    return { assetIds: [item.assetId], selectedRefIds: [] };
  }
  return { assetIds: [], selectedRefIds: [] };
}

export function mergeReferenceSources(
  base: ReferenceImageSources,
  canvasItem: CanvasItem | null | undefined,
  creationLane: CreationLane,
  focusEditActive: boolean,
): ReferenceImageSources {
  if (!canAutoBindCanvasItem(canvasItem, creationLane, focusEditActive) || !canvasItem) {
    return base;
  }
  const slice = canvasItemToReferenceSlice(canvasItem);
  return {
    assetIds: Array.from(new Set([...base.assetIds, ...slice.assetIds])),
    mentionedAssetIds: base.mentionedAssetIds,
    selectedRefIds: Array.from(
      new Set([...base.selectedRefIds, ...slice.selectedRefIds]),
    ),
  };
}
