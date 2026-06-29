"use client";

import { useCallback } from "react";
import {
  FileCode,
  ImageIcon,
  Video,
  Music,
  Type,
  Sparkles,
} from "lucide-react";
import type { CanvasNodeType } from "@/lib/canvas-node-types";
import {
  NODE_TYPE_LABELS,
  NODE_TYPE_DESCRIPTIONS,
} from "@/lib/canvas-node-types";
import { createCanvasNode } from "@/lib/api-client";

/** 节点类型图标映射 */
const NODE_ICONS: Record<CanvasNodeType, typeof FileCode> = {
  script: FileCode,
  image: ImageIcon,
  video: Video,
  audio: Music,
  text: Type,
  output: Sparkles,
};

/** 节点类型颜色 */
const NODE_COLORS: Record<CanvasNodeType, string> = {
  script: "text-violet-400 border-violet-500/30 hover:border-violet-500/60 hover:bg-violet-500/10",
  image: "text-orange-400 border-orange-500/30 hover:border-orange-500/60 hover:bg-orange-500/10",
  video: "text-cyan-400 border-cyan-500/30 hover:border-cyan-500/60 hover:bg-cyan-500/10",
  audio: "text-green-400 border-green-500/30 hover:border-green-500/60 hover:bg-green-500/10",
  text: "text-amber-400 border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/10",
  output: "text-pink-400 border-pink-500/30 hover:border-pink-500/60 hover:bg-pink-500/10",
};

const NODE_TYPES: CanvasNodeType[] = [
  "script",
  "image",
  "video",
  "audio",
  "text",
  "output",
];

interface CanvasNodeCreatorProps {
  sessionId: string;
  position: { x: number; y: number };
  onClose: () => void;
  onCreated: () => void;
}

/**
 * 1.5 节点类型选择器 UI
 * 双击空白处触发，弹出 5 种节点类型的选择弹窗
 */
export function CanvasNodeCreator({
  sessionId,
  position,
  onClose,
  onCreated,
}: CanvasNodeCreatorProps) {
  const handleSelect = useCallback(
    async (type: CanvasNodeType) => {
      try {
        await createCanvasNode(sessionId, {
          type,
          position,
          label: NODE_TYPE_LABELS[type],
        });
        onCreated();
      } catch {
        // 创建失败静默处理
      }
    },
    [sessionId, position, onCreated],
  );

  return (
    <>
      {/* 遮罩 */}
      <div
        className="fixed inset-0 z-50"
        onClick={onClose}
        aria-label="关闭节点创建器"
      />
      {/* 弹窗 */}
      <div
        className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
          w-[340px] rounded-xl border border-white/10 bg-[#0f0f0f] p-4 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-200">添加节点</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-500 hover:text-white transition-colors"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {NODE_TYPES.map((type) => {
            const Icon = NODE_ICONS[type];
            const colorClass = NODE_COLORS[type];
            return (
              <button
                key={type}
                type="button"
                onClick={() => void handleSelect(type)}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${colorClass}`}
              >
                <Icon className="size-5 shrink-0" />
                <div>
                  <p className="text-xs font-medium">{NODE_TYPE_LABELS[type]}</p>
                  <p className="text-[10px] opacity-70">{NODE_TYPE_DESCRIPTIONS[type]}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
