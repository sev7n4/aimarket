import type { CanvasItem } from "@/lib/canvas-tools";
import { assetUrl } from "@/lib/api-client";
import { randomUUID } from "@/lib/uuid";
import { CanvasNodeType } from "@/components/infinite-canvas/types";
import type { CanvasAgentOp } from "@/components/infinite-canvas/utils";

export const SESSION_ASSET_DRAG_TYPE = "application/x-aimarket-session-asset";

export function isSessionAssetDrag(dataTransfer: DataTransfer): boolean {
  return dataTransfer.types.includes(SESSION_ASSET_DRAG_TYPE);
}

export function readSessionAssetId(dataTransfer: DataTransfer): string | null {
  const id = dataTransfer.getData(SESSION_ASSET_DRAG_TYPE);
  return id.trim() ? id : null;
}

/** Session items with image/video URLs (excludes text/config/workflow nodes). */
export function listSessionMediaAssets(items: CanvasItem[]): CanvasItem[] {
  return items.filter((item) => {
    if (!item.url?.trim()) return false;
    if (
      item.infiniteNodeType === "text" ||
      item.infiniteNodeType === "config" ||
      item.infiniteNodeType === "workflow"
    ) {
      return false;
    }
    return true;
  });
}

export function buildAssetCloneOp(
  item: CanvasItem,
  worldX: number,
  worldY: number,
): CanvasAgentOp {
  const nodeType = item.isVideo ? CanvasNodeType.Video : CanvasNodeType.Image;
  return {
    type: "add_node",
    id: `${nodeType}-${randomUUID()}`,
    nodeType,
    title: item.label || item.batchTitle || (item.isVideo ? "Video" : "图片"),
    x: worldX,
    y: worldY,
    width: item.width,
    height: item.height,
    metadata: {
      content: assetUrl(item.url),
      status: "idle",
      naturalWidth: item.width,
      naturalHeight: item.height,
      primaryImageId: item.assetId,
      ...(item.infiniteNodeMeta?.prompt
        ? { prompt: item.infiniteNodeMeta.prompt }
        : {}),
    },
  };
}
