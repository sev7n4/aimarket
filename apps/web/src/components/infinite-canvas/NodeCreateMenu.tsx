"use client";

import { useEffect, useMemo } from "react";
import {
  Clapperboard,
  FileText,
  Image,
  Settings2,
  User,
  MapPin,
} from "lucide-react";
import { canvasTheme } from "./canvas-theme";
import { CanvasNodeType } from "./types";

export type NodeCreateOption = {
  type: CanvasNodeType;
  label: string;
  description: string;
  icon: typeof FileText;
  dramaOnly?: boolean;
};

const BASE_OPTIONS: NodeCreateOption[] = [
  {
    type: CanvasNodeType.Text,
    label: "文本",
    description: "备注、旁白、说明",
    icon: FileText,
  },
  {
    type: CanvasNodeType.Config,
    label: "生成配置",
    description: "图片/视频生成参数节点",
    icon: Settings2,
  },
];

const DRAMA_OPTIONS: NodeCreateOption[] = [
  {
    type: CanvasNodeType.Character,
    label: "角色",
    description: "新增角色资产节点",
    icon: User,
    dramaOnly: true,
  },
  {
    type: CanvasNodeType.Scene,
    label: "场景",
    description: "新增场景节点",
    icon: MapPin,
    dramaOnly: true,
  },
  {
    type: CanvasNodeType.Shot,
    label: "分镜",
    description: "新增分镜节点",
    icon: Clapperboard,
    dramaOnly: true,
  },
];

interface NodeCreateMenuProps {
  x: number;
  y: number;
  showDramaTypes?: boolean;
  onSelect: (type: CanvasNodeType) => void;
  onClose: () => void;
}

export function NodeCreateMenu({
  x,
  y,
  showDramaTypes = false,
  onSelect,
  onClose,
}: NodeCreateMenuProps) {
  const options = useMemo(
    () => [...BASE_OPTIONS, ...(showDramaTypes ? DRAMA_OPTIONS : [])],
    [showDramaTypes],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const style: React.CSSProperties = {
    left: Math.min(x, (typeof window !== "undefined" ? window.innerWidth : 1024) - 220),
    top: Math.min(y, (typeof window !== "undefined" ? window.innerHeight : 768) - 320),
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] cursor-default bg-transparent"
        aria-label="关闭菜单"
        onClick={onClose}
      />
      <div
        className="fixed z-[61] min-w-[200px] overflow-hidden rounded-xl border shadow-2xl backdrop-blur-md"
        style={{
          ...style,
          background: canvasTheme.toolbar.panel,
          borderColor: canvasTheme.toolbar.border,
        }}
        data-testid="node-create-menu"
        role="menu"
      >
        <div className="border-b px-3 py-2 text-[11px] font-medium text-zinc-400">
          添加节点
        </div>
        <ul className="py-1">
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <li key={opt.type}>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition hover:bg-white/5"
                  data-testid={`node-create-${opt.type}`}
                  onClick={() => {
                    onSelect(opt.type);
                    onClose();
                  }}
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-orange-400/90" />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-zinc-100">
                      {opt.label}
                    </span>
                    <span className="block text-[10px] text-zinc-500">
                      {opt.description}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {showDramaTypes ? (
          <div className="border-t px-3 py-1.5 text-[10px] text-zinc-600">
            制片模式：角色/场景/分镜将写入短剧草稿
          </div>
        ) : (
          <div className="flex items-center gap-1.5 border-t px-3 py-1.5 text-[10px] text-zinc-600">
            <Image className="size-3 opacity-60" />
            图片/视频节点由生成任务自动创建
          </div>
        )}
      </div>
    </>
  );
}
