"use client";

import { useEffect } from "react";
import { FileText, Settings2 } from "lucide-react";
import { canvasTheme } from "./canvas-theme";
import { CanvasNodeType } from "./types";

export type ConnectionCreateOption = {
  type: CanvasNodeType;
  label: string;
  description: string;
  icon: typeof FileText;
};

const DOWNSTREAM_OPTIONS: ConnectionCreateOption[] = [
  {
    type: CanvasNodeType.Config,
    label: "生成配置",
    description: "下游图片/视频生成参数",
    icon: Settings2,
  },
  {
    type: CanvasNodeType.Text,
    label: "文本",
    description: "备注或 prompt 节点",
    icon: FileText,
  },
];

interface ConnectionCreateMenuProps {
  x: number;
  y: number;
  onSelect: (type: CanvasNodeType) => void;
  onClose: () => void;
}

export function ConnectionCreateMenu({
  x,
  y,
  onSelect,
  onClose,
}: ConnectionCreateMenuProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const style: React.CSSProperties = {
    left: Math.min(x, (typeof window !== "undefined" ? window.innerWidth : 1024) - 220),
    top: Math.min(y, (typeof window !== "undefined" ? window.innerHeight : 768) - 200),
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
        data-testid="connection-create-menu"
        data-connection-create-menu
        role="menu"
      >
        <div className="border-b px-3 py-2 text-[11px] font-medium text-zinc-400">
          创建下游节点
        </div>
        <ul className="py-1">
          {DOWNSTREAM_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <li key={opt.type}>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition hover:bg-white/5"
                  data-testid={`connection-create-${opt.type}`}
                  onClick={() => {
                    onSelect(opt.type);
                    onClose();
                  }}
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-sky-400/90" />
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
      </div>
    </>
  );
}
