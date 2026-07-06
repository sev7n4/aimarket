import {
  Camera,
  Clapperboard,
  Compass,
  Download,
  GitBranch,
  Grid3x3,
  Image as ImageIcon,
  Lightbulb,
  Music,
  Pencil,
  RefreshCw,
  RotateCcw,
  Scissors,
  Sparkles,
  Square,
  Star,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { OverflowIconAction } from "@/components/overflow-icon-row";
import { CanvasNodeType, type CanvasNodeData } from "./types";

export type InfiniteNodeMenuAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  danger?: boolean;
  separatorAfter?: boolean;
};

export type InfiniteNodeMenuGroup = {
  id: string;
  actions: InfiniteNodeMenuAction[];
};

export type InfiniteNodeMenuHandlers = {
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
  onStoryboardEvolve?: () => void;
  onTurnaround360?: () => void;
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
};

function menuAction(
  id: string,
  label: string,
  icon: LucideIcon,
  onClick: (() => void) | undefined,
  opts: { danger?: boolean; separatorAfter?: boolean } = {},
): InfiniteNodeMenuAction {
  return { id, label, icon, onClick, danger: opts.danger, separatorAfter: opts.separatorAfter };
}

/** 按节点类型构建右键菜单 / 工具链动作组 */
export function buildInfiniteNodeMenuGroups(
  node: CanvasNodeData,
  handlers: InfiniteNodeMenuHandlers,
  options?: { wrapOnClick?: (fn?: () => void) => (() => void) | undefined },
): InfiniteNodeMenuGroup[] {
  const wrap =
    options?.wrapOnClick ??
    ((fn?: () => void) => (fn ? () => fn() : undefined));
  const t = node.type;

  if (t === CanvasNodeType.Image) {
    return [
      {
        id: "image-edit",
        actions: [
          menuAction("cutout", "抠图", Scissors, wrap(handlers.onCutout)),
          menuAction("expand", "扩图", Square, wrap(handlers.onExpand)),
          menuAction("recompose", "重新合成", Wand2, wrap(handlers.onRecompose)),
          menuAction("rerun", "重新生成", RefreshCw, wrap(handlers.onRerun), {
            separatorAfter: true,
          }),
          menuAction("multi-cam-9", "多机位 9 宫格", Grid3x3, wrap(handlers.onMultiCam9)),
          menuAction("multi-cam-25", "多机位 25 宫格", Compass, wrap(handlers.onMultiCam25)),
          menuAction(
            "storyboard-evolve",
            "剧情推演四宫格",
            GitBranch,
            wrap(handlers.onStoryboardEvolve),
          ),
          menuAction(
            "turnaround-360",
            "360° 角度呈现",
            RotateCcw,
            wrap(handlers.onTurnaround360),
          ),
          menuAction("lighting", "灯光控制", Lightbulb, wrap(handlers.onLighting)),
          menuAction("camera", "摄像机控制", Camera, wrap(handlers.onCamera), {
            separatorAfter: true,
          }),
          menuAction("music", "AI 音乐生成", Music, wrap(handlers.onMusicGen), {
            separatorAfter: true,
          }),
          menuAction("download", "下载", Download, wrap(handlers.onDownload), {
            separatorAfter: true,
          }),
          menuAction("delete", "删除", Trash2, wrap(handlers.onDelete), { danger: true }),
        ],
      },
    ];
  }

  if (t === CanvasNodeType.Video) {
    return [
      {
        id: "video-edit",
        actions: [
          menuAction("video-inpaint", "视频精准编辑", Pencil, wrap(handlers.onVideoInpaint)),
          menuAction("rerun", "重新生成", RefreshCw, wrap(handlers.onRerun)),
          menuAction("keyframe", "抽取关键帧", Star, wrap(handlers.onExtractKeyframe), {
            separatorAfter: true,
          }),
          menuAction("music", "AI 音乐生成", Music, wrap(handlers.onMusicGen), {
            separatorAfter: true,
          }),
          menuAction("download", "下载", Download, wrap(handlers.onDownload), {
            separatorAfter: true,
          }),
          menuAction("delete", "删除", Trash2, wrap(handlers.onDelete), { danger: true }),
        ],
      },
    ];
  }

  if (t === CanvasNodeType.Script) {
    return [
      {
        id: "script",
        actions: [
          menuAction("edit-script", "编辑剧本", Pencil, wrap(handlers.onEditScript)),
          menuAction("generate-shots", "生成分镜", Sparkles, wrap(handlers.onGenerateShotImage), {
            separatorAfter: true,
          }),
          menuAction("delete", "删除", Trash2, wrap(handlers.onDelete), { danger: true }),
        ],
      },
    ];
  }

  if (t === CanvasNodeType.Shot) {
    return [
      {
        id: "shot",
        actions: [
          menuAction("shot-image", "生成分镜图", ImageIcon, wrap(handlers.onGenerateShotImage)),
          menuAction("shot-video", "生成分镜视频", Clapperboard, wrap(handlers.onGenerateShotVideo)),
          menuAction("edit-shot", "编辑对白", Pencil, wrap(handlers.onEditShot)),
          menuAction("multi-cam-9", "多机位 9 宫格", Grid3x3, wrap(handlers.onMultiCam9)),
          menuAction("multi-cam-25", "多机位 25 宫格", Compass, wrap(handlers.onMultiCam25)),
          menuAction(
            "storyboard-evolve",
            "剧情推演四宫格",
            GitBranch,
            wrap(handlers.onStoryboardEvolve),
          ),
          menuAction(
            "turnaround-360",
            "360° 角度呈现",
            RotateCcw,
            wrap(handlers.onTurnaround360),
          ),
          menuAction("rerun", "重新生成", RefreshCw, wrap(handlers.onRerun), {
            separatorAfter: true,
          }),
          menuAction("lighting", "灯光控制", Lightbulb, wrap(handlers.onLighting)),
          menuAction("camera", "摄像机控制", Camera, wrap(handlers.onCamera), {
            separatorAfter: true,
          }),
          menuAction("delete", "删除", Trash2, wrap(handlers.onDelete), { danger: true }),
        ],
      },
    ];
  }

  if (t === CanvasNodeType.Character) {
    return [
      {
        id: "character",
        actions: [
          menuAction(
            "char-sheet",
            "生成三视图",
            Sparkles,
            wrap(handlers.onGenerateCharacterSheet),
          ),
          menuAction(
            "turnaround-360",
            "360° 角度呈现",
            RotateCcw,
            wrap(handlers.onTurnaround360),
          ),
          menuAction("edit-character", "编辑三视图", Pencil, wrap(handlers.onEditCharacter), {
            separatorAfter: true,
          }),
          menuAction("delete", "删除", Trash2, wrap(handlers.onDelete), { danger: true }),
        ],
      },
    ];
  }

  if (t === CanvasNodeType.Scene) {
    return [
      {
        id: "scene",
        actions: [
          menuAction("edit-scene", "编辑场景", Pencil, wrap(handlers.onEditScene)),
          menuAction("upload-ref", "上传参考图", Upload, wrap(handlers.onEditScene), {
            separatorAfter: true,
          }),
          menuAction("delete", "删除", Trash2, wrap(handlers.onDelete), { danger: true }),
        ],
      },
    ];
  }

  return [
    {
      id: "basic",
      actions: [
        menuAction("rerun", "重新生成", RefreshCw, wrap(handlers.onRerun), {
          separatorAfter: true,
        }),
        menuAction("download", "下载", Download, wrap(handlers.onDownload), {
          separatorAfter: true,
        }),
        menuAction("delete", "删除", Trash2, wrap(handlers.onDelete), { danger: true }),
      ],
    },
  ];
}

/** 将节点菜单动作转为选中节点工具链图标行 */
export function infiniteNodeMenuToToolbarActions(
  groups: InfiniteNodeMenuGroup[],
): OverflowIconAction[] {
  return groups
    .flatMap((group) => group.actions)
    .filter((action) => Boolean(action.onClick))
    .map((action) => ({
      id: `infinite-node-tool-${action.id}`,
      icon: action.icon,
      title: action.label,
      onClick: action.onClick!,
      tone: action.danger ? ("red" as const) : ("orange" as const),
    }));
}
