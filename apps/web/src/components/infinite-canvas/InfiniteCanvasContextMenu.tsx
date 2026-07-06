"use client";

import { useEffect, useMemo } from "react";
import { X } from "lucide-react";

import { buildCanvasNodeActions } from "@/lib/canvas-node-actions";
import { canvasTheme } from "./canvas-theme";
import { CanvasNodeType, type CanvasNodeData } from "./types";
import type { InfiniteNodeMenuHandlers } from "./infinite-node-menu-actions";

export interface InfiniteCanvasContextMenuProps {
  node: CanvasNodeData;
  x: number;
  y: number;
  onClose: () => void;
  handlers: InfiniteNodeMenuHandlers;
}

export function InfiniteCanvasContextMenu({
  node,
  x,
  y,
  onClose,
  handlers,
}: InfiniteCanvasContextMenuProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const groups = useMemo(
    () =>
      buildCanvasNodeActions({
        mode: "infinite",
        node,
        handlers,
        wrapOnClick: (fn) =>
          fn
            ? () => {
                fn();
                onClose();
              }
            : undefined,
      }),
    [node, handlers, onClose],
  );

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
