"use client";

import { useCallback } from "react";

import type { InfiniteNodeMenuHandlers } from "@/components/infinite-canvas/infinite-node-menu-actions";
import { CanvasNodeType, type CanvasNodeData } from "@/components/infinite-canvas/types";
import { assetUrl } from "@/lib/api-client";
import type { CanvasItem } from "@/lib/canvas-tools";

export type InfiniteNodeMenuHandlerContext = {
  items: CanvasItem[];
  onCutoutItem?: (item: CanvasItem) => void;
  onExpandItem?: (item: CanvasItem) => void;
  onRerun?: (item: CanvasItem) => void;
  onDownloadItem?: (item: CanvasItem) => void;
  onDeleteNodes: (nodeIds: string[]) => void;
  onSelect: (id: string | null) => void;
  onOpenLightbox: (items: CanvasItem[], index: number) => void;
  onVideoInpaint: (node: CanvasNodeData) => void;
  onOpenLighting: (node: CanvasNodeData) => void;
  onOpenCamera: (node: CanvasNodeData) => void;
  onMusicGen: () => void;
  onRunInfiniteNodeTool: (toolId: string, node: CanvasNodeData) => void;
  onEditDramaNode: (nodeId: string) => void;
  onExtractVideoLastFrame?: (item: CanvasItem) => void;
  onGenerateShotImage?: (node: CanvasNodeData) => void;
  onGenerateShotVideo?: (node: CanvasNodeData) => void;
  onGenerateCharacterSheet?: (node: CanvasNodeData) => void;
  onGenerateShotsFromScript?: (node: CanvasNodeData) => void;
};

function itemForNode(items: CanvasItem[], node: CanvasNodeData): CanvasItem | null {
  if (node.type !== CanvasNodeType.Image && node.type !== CanvasNodeType.Video) {
    return null;
  }
  return items.find((i) => i.id === node.id) ?? null;
}

export type BuildInfiniteNodeMenuHandlersOptions = {
  openAssetUrl?: (url: string) => void;
};

/** Infinite 节点右键菜单 / 工具链共用 handler 工厂（纯函数，供单测） */
export function buildInfiniteNodeMenuHandlers(
  node: CanvasNodeData,
  ctx: InfiniteNodeMenuHandlerContext,
  options?: BuildInfiniteNodeMenuHandlersOptions,
): InfiniteNodeMenuHandlers {
  const {
    items,
    onCutoutItem,
    onExpandItem,
    onRerun,
    onDownloadItem,
    onDeleteNodes,
    onSelect,
    onOpenLightbox,
    onVideoInpaint,
    onOpenLighting,
    onOpenCamera,
    onMusicGen,
    onRunInfiniteNodeTool,
    onEditDramaNode,
    onExtractVideoLastFrame,
    onGenerateShotImage,
    onGenerateShotVideo,
    onGenerateCharacterSheet,
    onGenerateShotsFromScript,
  } = ctx;
  const openAssetUrl = options?.openAssetUrl ?? ((url: string) => {
    window.open(assetUrl(url), "_blank");
  });
  const item = itemForNode(items, node);

  return {
    onCutout: onCutoutItem && item ? () => onCutoutItem(item) : undefined,
    onExpand: onExpandItem && item ? () => onExpandItem(item) : undefined,
    onRerun: onRerun && item ? () => onRerun(item) : undefined,
    onDownload: () => {
      if (item) onDownloadItem?.(item);
      else openAssetUrl(node.metadata?.content ?? "");
    },
    onDelete: () => onDeleteNodes([node.id]),
    onRecompose: item
      ? () => {
          const idx = items.findIndex((i) => i.id === item.id);
          onOpenLightbox(items, idx >= 0 ? idx : 0);
          onSelect(item.id);
        }
      : undefined,
    onVideoInpaint: () => onVideoInpaint(node),
    onMusicGen,
    onMultiCam9: () => onRunInfiniteNodeTool("multi-cam-9", node),
    onMultiCam25: () => onRunInfiniteNodeTool("multi-cam-25", node),
    onStoryboardEvolve: () => onRunInfiniteNodeTool("storyboard-evolve", node),
    onTurnaround360: () => onRunInfiniteNodeTool("turnaround-360", node),
    onLighting: () => onOpenLighting(node),
    onCamera: () => onOpenCamera(node),
    onEditScript: () => onEditDramaNode(node.id),
    onEditShot: () => onEditDramaNode(node.id),
    onEditCharacter: () => onEditDramaNode(node.id),
    onEditScene: () => onEditDramaNode(node.id),
    onGenerateShotImage: onGenerateShotImage
      ? () => onGenerateShotImage(node)
      : onGenerateShotsFromScript && node.type === CanvasNodeType.Script
        ? () => onGenerateShotsFromScript(node)
        : undefined,
    onGenerateShotVideo: onGenerateShotVideo
      ? () => onGenerateShotVideo(node)
      : undefined,
    onGenerateCharacterSheet: onGenerateCharacterSheet
      ? () => onGenerateCharacterSheet(node)
      : undefined,
    onExtractKeyframe:
      item && onExtractVideoLastFrame
        ? () => onExtractVideoLastFrame(item)
        : undefined,
  };
}

/** Infinite 节点右键菜单 / 工具链共用 handler 工厂 */
export function useInfiniteNodeMenuHandlers(ctx: InfiniteNodeMenuHandlerContext) {
  return useCallback(
    (node: CanvasNodeData) => buildInfiniteNodeMenuHandlers(node, ctx),
    [
      ctx.items,
      ctx.onCutoutItem,
      ctx.onExpandItem,
      ctx.onRerun,
      ctx.onDownloadItem,
      ctx.onDeleteNodes,
      ctx.onSelect,
      ctx.onOpenLightbox,
      ctx.onVideoInpaint,
      ctx.onOpenLighting,
      ctx.onOpenCamera,
      ctx.onMusicGen,
      ctx.onRunInfiniteNodeTool,
      ctx.onEditDramaNode,
      ctx.onExtractVideoLastFrame,
      ctx.onGenerateShotImage,
      ctx.onGenerateShotVideo,
      ctx.onGenerateCharacterSheet,
      ctx.onGenerateShotsFromScript,
    ],
  );
}
