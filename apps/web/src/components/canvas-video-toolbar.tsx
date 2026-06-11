"use client";

import { Film, Music2, RotateCcw } from "lucide-react";
import { OverflowIconRow, type OverflowIconAction } from "@/components/overflow-icon-row";

interface CanvasVideoToolbarProps {
  visible: boolean;
  canRerun: boolean;
  onRerun: () => void;
  onExtractLastFrame: () => void;
  onAddBgm: () => void;
  busy?: boolean;
}

/** 视频成果底部专用操作栏（对标极梦：重生成 / 提取尾帧 / 配乐） */
export function CanvasVideoToolbar({
  visible,
  canRerun,
  onRerun,
  onExtractLastFrame,
  onAddBgm,
  busy = false,
}: CanvasVideoToolbarProps) {
  if (!visible) return null;

  const actions: OverflowIconAction[] = [
    {
      id: "video-rerun",
      icon: RotateCcw,
      title: "重新生成",
      tone: "blue",
      disabled: !canRerun || busy,
      onClick: onRerun,
    },
    {
      id: "video-extract-last-frame",
      icon: Film,
      title: "提取尾帧为参考图",
      disabled: busy,
      onClick: onExtractLastFrame,
    },
    {
      id: "video-add-bgm",
      icon: Music2,
      title: "添加背景音乐",
      tone: "purple",
      disabled: busy,
      onClick: onAddBgm,
    },
  ];

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-1.5 pb-1.5 pt-8"
      data-testid="canvas-video-toolbar"
    >
      <div className="pointer-events-auto">
        <OverflowIconRow actions={actions} maxVisible={3} size="sm" align="start" />
      </div>
    </div>
  );
}
