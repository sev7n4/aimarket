"use client";

import { useEffect, useMemo } from "react";
import {
  Camera,
  Clapperboard,
  Compass,
  Download,
  Grid3x3,
  Image as ImageIcon,
  Lightbulb,
  Music,
  Pencil,
  RefreshCw,
  Scissors,
  Sparkles,
  Square,
  Star,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { canvasTheme } from "./canvas-theme";
import { CanvasNodeType, type CanvasNodeData } from "./types";

/**
 * 无限画布节点右键菜单 (Phase 4 Task 4.1 / 4.2)
 *
 * 接受 CanvasNodeData，按 node.type 分组显示动作。
 * 所有动作回调为 undefined 时按钮置灰。
 */

type MenuAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  danger?: boolean;
  separatorAfter?: boolean;
};

type MenuGroup = {
  id: string;
  actions: MenuAction[];
};

export interface InfiniteCanvasContextMenuProps {
  node: CanvasNodeData;
  x: number;
  y: number;
  onClose: () => void;
  onCutout?: () => void;
  onExpand?: () => void;
  onRerun?: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
  onRecompose?: () => void;
  onVideoInpaint?: () => void;
  onMusicGen?: () => void;
  onMultiCam9?: () => void;
  onMultiCam25?: () => void;
  onLighting?: () => void;
  onCamera?: () => void;
  onEditScript?: () => void;
  onEditShot?: () => void;
  onEditCharacter?: () => void;
  onEditScene?: () => void;
  onGenerateShotImage?: () => void;
  onGenerateShotVideo?: () => void;
  onGenerateCharacterSheet?: () => void;
  onExtractKeyframe?: () => void;
}

function action(
  id: string,
  label: string,
  icon: LucideIcon,
  onClick: (() => void) | undefined,
  opts: { danger?: boolean; separatorAfter?: boolean } = {},
): MenuAction {
  return { id, label, icon, onClick, danger: opts.danger, separatorAfter: opts.separatorAfter };
}

export function InfiniteCanvasContextMenu({
  node,
  x,
  y,
  onClose,
  onCutout,
  onExpand,
  onRerun,
  onDownload,
  onDelete,
  onRecompose,
  onVideoInpaint,
  onMusicGen,
  onMultiCam9,
  onMultiCam25,
  onLighting,
  onCamera,
  onEditScript,
  onEditShot,
  onEditCharacter,
  onEditScene,
  onGenerateShotImage,
  onGenerateShotVideo,
  onGenerateCharacterSheet,
  onExtractKeyframe,
}: InfiniteCanvasContextMenuProps) {
  // 外部点击 + Escape 关闭
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 根据节点类型组装菜单组
  const groups = useMemo<MenuGroup[]>(() => {
    const invoke = (fn?: () => void) => (fn ? () => { fn(); onClose(); } : undefined);
    const t = node.type;

    if (t === CanvasNodeType.Image) {
      return [
        {
          id: "image-edit",
          actions: [
            action("cutout", "抠图", Scissors, invoke(onCutout)),
            action("expand", "扩图", Square, invoke(onExpand)),
            action("recompose", "重新合成", Wand2, invoke(onRecompose)),
            action("rerun", "重新生成", RefreshCw, invoke(onRerun), { separatorAfter: true }),
            action("multi-cam-9", "多机位 9 宫格", Grid3x3, invoke(onMultiCam9)),
            action("multi-cam-25", "多机位 25 宫格", Compass, invoke(onMultiCam25)),
            action("lighting", "灯光控制", Lightbulb, invoke(onLighting)),
            action("camera", "摄像机控制", Camera, invoke(onCamera), { separatorAfter: true }),
            action("music", "AI 音乐生成", Music, invoke(onMusicGen), { separatorAfter: true }),
            action("download", "下载", Download, invoke(onDownload), { separatorAfter: true }),
            action("delete", "删除", Trash2, invoke(onDelete), { danger: true }),
          ],
        },
      ];
    }

    if (t === CanvasNodeType.Video) {
      return [
        {
          id: "video-edit",
          actions: [
            action("video-inpaint", "视频精准编辑", Pencil, invoke(onVideoInpaint)),
            action("rerun", "重新生成", RefreshCw, invoke(onRerun)),
            action("keyframe", "抽取关键帧", Star, invoke(onExtractKeyframe), { separatorAfter: true }),
            action("music", "AI 音乐生成", Music, invoke(onMusicGen), { separatorAfter: true }),
            action("download", "下载", Download, invoke(onDownload), { separatorAfter: true }),
            action("delete", "删除", Trash2, invoke(onDelete), { danger: true }),
          ],
        },
      ];
    }

    if (t === CanvasNodeType.Script) {
      return [
        {
          id: "script",
          actions: [
            action("edit-script", "编辑剧本", Pencil, invoke(onEditScript)),
            action("generate-shots", "生成分镜", Sparkles, invoke(onGenerateShotImage), { separatorAfter: true }),
            action("delete", "删除", Trash2, invoke(onDelete), { danger: true }),
          ],
        },
      ];
    }

    if (t === CanvasNodeType.Shot) {
      return [
        {
          id: "shot",
          actions: [
            action("shot-image", "生成分镜图", ImageIcon, invoke(onGenerateShotImage)),
            action("shot-video", "生成分镜视频", Clapperboard, invoke(onGenerateShotVideo)),
            action("edit-shot", "编辑对白", Pencil, invoke(onEditShot)),
            action("multi-cam-9", "多机位 9 宫格", Grid3x3, invoke(onMultiCam9)),
            action("multi-cam-25", "多机位 25 宫格", Compass, invoke(onMultiCam25)),
            action("rerun", "重新生成", RefreshCw, invoke(onRerun), { separatorAfter: true }),
            action("lighting", "灯光控制", Lightbulb, invoke(onLighting)),
            action("camera", "摄像机控制", Camera, invoke(onCamera), { separatorAfter: true }),
            action("delete", "删除", Trash2, invoke(onDelete), { danger: true }),
          ],
        },
      ];
    }

    if (t === CanvasNodeType.Character) {
      return [
        {
          id: "character",
          actions: [
            action("char-sheet", "生成三视图", Sparkles, invoke(onGenerateCharacterSheet)),
            action("edit-character", "编辑三视图", Pencil, invoke(onEditCharacter), { separatorAfter: true }),
            action("delete", "删除", Trash2, invoke(onDelete), { danger: true }),
          ],
        },
      ];
    }

    if (t === CanvasNodeType.Scene) {
      return [
        {
          id: "scene",
          actions: [
            action("edit-scene", "编辑场景", Pencil, invoke(onEditScene)),
            action("upload-ref", "上传参考图", Upload, invoke(onEditScene), { separatorAfter: true }),
            action("delete", "删除", Trash2, invoke(onDelete), { danger: true }),
          ],
        },
      ];
    }

    // Text / Audio / Config：基础操作
    return [
      {
        id: "basic",
        actions: [
          action("rerun", "重新生成", RefreshCw, invoke(onRerun), { separatorAfter: true }),
          action("download", "下载", Download, invoke(onDownload), { separatorAfter: true }),
          action("delete", "删除", Trash2, invoke(onDelete), { danger: true }),
        ],
      },
    ];
  }, [
    node.type,
    onCutout,
    onExpand,
    onRerun,
    onDownload,
    onDelete,
    onRecompose,
    onVideoInpaint,
    onMusicGen,
    onMultiCam9,
    onMultiCam25,
    onLighting,
    onCamera,
    onEditScript,
    onEditShot,
    onEditCharacter,
    onEditScene,
    onGenerateShotImage,
    onGenerateShotVideo,
    onGenerateCharacterSheet,
    onExtractKeyframe,
    onClose,
  ]);

  // 防止菜单溢出视口：右/下边超出时贴边
  const style: React.CSSProperties = {
    left: Math.min(x, (typeof window !== "undefined" ? window.innerWidth : 1024) - 240),
    top: Math.min(y, (typeof window !== "undefined" ? window.innerHeight : 768) - 400),
  };

  const nodeTypeLabel = useMemo(() => {
    const map: Record<CanvasNodeType, string> = {
      [CanvasNodeType.Image]: "图片",
      [CanvasNodeType.Text]: "文本",
      [CanvasNodeType.Config]: "配置",
      [CanvasNodeType.Video]: "视频",
      [CanvasNodeType.Audio]: "音频",
      [CanvasNodeType.Script]: "剧本",
      [CanvasNodeType.Shot]: "分镜",
      [CanvasNodeType.Character]: "角色",
      [CanvasNodeType.Scene]: "场景",
    };
    return map[node.type] ?? "节点";
  }, [node.type]);

  return (
    <>
      {/* 透明遮罩：用于点击外部关闭 */}
      <button
        type="button"
        className="fixed inset-0 z-50 cursor-default"
        aria-label="关闭菜单"
        onClick={onClose}
      />
      <div
        className="fixed z-[51] min-w-[200px] overflow-hidden rounded-xl py-1 shadow-2xl"
        style={{
          ...style,
          background: canvasTheme.toolbar.panel,
          border: `1px solid ${canvasTheme.toolbar.border}`,
        }}
        data-testid="infinite-canvas-context-menu"
      >
        {/* 标题栏：节点类型 + 标题 */}
        <div
          className="flex items-center justify-between gap-2 px-3 py-1.5 text-[10px]"
          style={{
            color: canvasTheme.node.faint,
            borderBottom: `1px solid ${canvasTheme.toolbar.border}`,
          }}
        >
          <span className="font-medium uppercase tracking-wide">{nodeTypeLabel}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-0.5 transition hover:bg-white/10"
            aria-label="关闭"
            style={{ color: canvasTheme.node.faint }}
          >
            <X className="size-3" />
          </button>
        </div>
        {node.title ? (
          <div
            className="max-w-[260px] truncate px-3 py-1 text-[11px]"
            style={{ color: canvasTheme.node.muted }}
            title={node.title}
          >
            {node.title}
          </div>
        ) : null}

        {/* 动作组 */}
        {groups.map((group) => (
          <div key={group.id} className="py-1">
            {group.actions.map((a) => {
              const Icon = a.icon;
              const disabled = !a.onClick;
              return (
                <div key={a.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={a.onClick}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      color: disabled
                        ? canvasTheme.node.faint
                        : a.danger
                          ? "#fca5a5"
                          : canvasTheme.node.muted,
                    }}
                    onMouseEnter={(e) => {
                      if (!disabled) {
                        e.currentTarget.style.background = canvasTheme.toolbar.itemHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    <span className="truncate">{a.label}</span>
                  </button>
                  {a.separatorAfter ? (
                    <div
                      className="mx-2 my-0.5 h-px"
                      style={{ background: canvasTheme.toolbar.border }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
