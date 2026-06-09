"use client";

import {
  Download,
  Eye,
  Plus,
  RotateCcw,
  Share2,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import type { CanvasItem } from "@/lib/canvas-tools";
import type { StudioTool } from "@/lib/types";
import { OverflowIconRow, type OverflowIconAction } from "@/components/overflow-icon-row";
import { buildCanvasToolActions } from "@/components/canvas-tool-actions";

interface ScrollCanvasItemChromeProps {
  item: CanvasItem;
  selected: boolean;
  readOnly: boolean;
  tools?: StudioTool[];
  pendingToolId?: string | null;
  onPreview: () => void;
  onRefine: () => void;
  onRerun: () => void;
  onDelete: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  onPublish?: () => void;
  publishDisabled?: boolean;
  onRunTool?: (tool: StudioTool, item: CanvasItem) => void;
  onMentionItem?: (item: CanvasItem) => void;
}

export function ScrollCanvasItemChrome({
  item,
  selected,
  readOnly,
  tools = [],
  pendingToolId = null,
  onPreview,
  onRefine,
  onRerun,
  onDelete,
  onDownload,
  onShare,
  onPublish,
  publishDisabled = false,
  onRunTool,
  onMentionItem,
}: ScrollCanvasItemChromeProps) {
  if (readOnly) return null;

  const show = selected
    ? "pointer-events-auto opacity-100"
    : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100";

  const topActions: OverflowIconAction[] = [
    {
      id: "canvas-preview",
      icon: Eye,
      title: "预览大图（双击图片）",
      onClick: onPreview,
    },
    {
      id: "canvas-refine",
      icon: Wand2,
      title: "进入精修：圈选、对比、连续迭代",
      tone: "orange",
      onClick: onRefine,
    },
    {
      id: "canvas-delete",
      icon: Trash2,
      title: "删除",
      tone: "red",
      onClick: onDelete,
    },
    ...(onDownload
      ? [
          {
            id: "canvas-download",
            icon: Download,
            title: "下载",
            onClick: onDownload,
          } satisfies OverflowIconAction,
        ]
      : []),
    {
      id: "canvas-rerun",
      icon: RotateCcw,
      title: "重做",
      tone: "blue",
      disabled: !item.generationParams,
      onClick: onRerun,
    },
    ...(onShare
      ? [
          {
            id: "canvas-share",
            icon: Share2,
            title: "分享",
            onClick: onShare,
          } satisfies OverflowIconAction,
        ]
      : []),
    ...(onPublish
      ? [
          {
            id: "canvas-publish",
            icon: Sparkles,
            title: "发布到灵感发现",
            tone: "purple",
            disabled: publishDisabled,
            onClick: onPublish,
          } satisfies OverflowIconAction,
        ]
      : []),
  ];

  const toolActions = buildCanvasToolActions({
    tools,
    item,
    pendingToolId,
    onRunTool,
  });

  const hasToolchain = toolActions.length > 0;

  return (
    <>
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-50 bg-gradient-to-b from-black/80 via-black/35 to-transparent px-1.5 pb-7 pt-1.5 transition-opacity ${show}`}
      >
        <div className="pointer-events-auto">
          <OverflowIconRow actions={topActions} maxVisible={4} size="sm" />
        </div>
      </div>
      {onMentionItem && (item.outputId || item.assetId) ? (
        <button
          type="button"
          title="引用到工作台"
          aria-label="引用到工作台"
          data-testid="canvas-item-quick-mention"
          className={`absolute right-2 top-1/2 z-50 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/[0.58] text-white shadow-[0_10px_28px_rgba(0,0,0,0.38)] backdrop-blur-md transition hover:scale-105 hover:border-orange-300/60 hover:bg-orange-500/80 ${show}`}
          onClick={(e) => {
            e.stopPropagation();
            onMentionItem(item);
          }}
        >
          <Plus className="size-4" strokeWidth={2} />
        </button>
      ) : null}
      {hasToolchain ? (
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-1.5 pb-1.5 pt-6 transition-opacity ${show}`}
          data-testid="canvas-item-toolchain"
        >
          <div className="pointer-events-auto">
            <OverflowIconRow
              actions={toolActions}
              maxVisible={5}
              size="sm"
              align="start"
              menuPlacement="side"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
