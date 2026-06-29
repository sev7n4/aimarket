"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  FileCode,
  ImageIcon,
  Video,
  Music,
  Type,
  Sparkles,
  Search,
} from "lucide-react";
import type { CanvasNodeType } from "@/lib/canvas-node-types";
import {
  NODE_TYPE_LABELS,
  NODE_TYPE_DESCRIPTIONS,
} from "@/lib/canvas-node-types";
import { createCanvasNode } from "@/lib/api-client";

const NODE_ICONS: Record<CanvasNodeType, typeof FileCode> = {
  script: FileCode,
  image: ImageIcon,
  video: Video,
  audio: Music,
  text: Type,
  output: Sparkles,
};

const NODE_COLORS: Record<CanvasNodeType, string> = {
  script: "text-violet-400 border-violet-500/40 hover:bg-violet-500/15",
  image: "text-orange-400 border-orange-500/40 hover:bg-orange-500/15",
  video: "text-cyan-400 border-cyan-500/40 hover:bg-cyan-500/15",
  audio: "text-green-400 border-green-500/40 hover:bg-green-500/15",
  text: "text-amber-400 border-amber-500/40 hover:bg-amber-500/15",
  output: "text-pink-400 border-pink-500/40 hover:bg-pink-500/15",
};

const ALL_NODE_TYPES: CanvasNodeType[] = [
  "script",
  "image",
  "video",
  "audio",
  "text",
  "output",
];

interface CanvasCommandPaletteProps {
  open: boolean;
  sessionId: string;
  /** 当前画布中心坐标（用于在视觉中心创建节点） */
  position: { x: number; y: number };
  onClose: () => void;
  onCreated: () => void;
}

/**
 * 3.2 Slash 命令面板：键盘流用户的快捷节点创建入口
 * 触发方式：在画布内按 `/` 键
 */
export function CanvasCommandPalette({
  open,
  sessionId,
  position,
  onClose,
  onCreated,
}: CanvasCommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_NODE_TYPES;
    return ALL_NODE_TYPES.filter((t) => {
      const label = NODE_TYPE_LABELS[t];
      const desc = NODE_TYPE_DESCRIPTIONS[t];
      return (
        t.includes(q) ||
        label.toLowerCase().includes(q) ||
        desc.toLowerCase().includes(q)
      );
    });
  }, [query]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

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
        // 静默失败
      }
    },
    [sessionId, position, onCreated],
  );

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, filtered.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const type = filtered[highlight];
        if (type) void handleSelect(type);
        return;
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, filtered, highlight, handleSelect, onClose]);

  if (!open) return null;

  return (
    <>
      {/* 遮罩 */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label="关闭命令面板"
      />
      {/* 面板 */}
      <div
        className="fixed z-50 left-1/2 top-[20%] -translate-x-1/2
          w-[420px] rounded-xl border border-white/10 bg-[#0f0f0f] shadow-2xl"
      >
        {/* 搜索框 */}
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          <Search className="size-4 text-zinc-500" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入节点类型名称或 / 关键词..."
            className="flex-1 bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
          />
          <kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-500">
            Esc
          </kbd>
        </div>

        {/* 选项列表 */}
        <div className="max-h-[360px] overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-zinc-500">
              无匹配的节点类型
            </p>
          ) : (
            filtered.map((type, i) => {
              const Icon = NODE_ICONS[type];
              const active = i === highlight;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => void handleSelect(type)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                    active
                      ? NODE_COLORS[type]
                      : "border-transparent text-zinc-400 hover:bg-white/5"
                  }`}
                >
                  <Icon className="size-5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium">{NODE_TYPE_LABELS[type]}</p>
                    <p className="text-[10px] opacity-70">
                      {NODE_TYPE_DESCRIPTIONS[type]}
                    </p>
                  </div>
                  {active ? (
                    <kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-zinc-400">
                      ↵
                    </kbd>
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-white/10 px-3 py-1.5 text-[10px] text-zinc-600 flex items-center gap-3">
          <span>↑↓ 选择</span>
          <span>↵ 创建</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </>
  );
}
