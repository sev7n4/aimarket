"use client";

import type { LucideIcon } from "lucide-react";

import type { CanvasNodeMenuGroup } from "@/lib/canvas-node-actions";

interface CanvasContextMenuProps {
  groups: CanvasNodeMenuGroup[];
  x: number;
  y: number;
  onClose: () => void;
}

/** Scroll 画布右键菜单（动作来自 buildCanvasNodeActions） */
export function CanvasContextMenu({
  groups,
  x,
  y,
  onClose,
}: CanvasContextMenuProps) {
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-50"
        aria-label="关闭菜单"
        onClick={onClose}
      />
      <div
        className="fixed z-[51] min-w-[140px] rounded-xl border border-white/10 bg-[#141414] py-1 shadow-2xl"
        style={{ left: x, top: y }}
        data-testid="scroll-canvas-context-menu"
      >
        {groups.map((group) => (
          <div key={group.id}>
            {group.actions.map((action) => {
              const Icon = action.icon as LucideIcon;
              const disabled = !action.onClick;
              return (
                <div key={action.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    className={`block w-full px-4 py-2 text-left text-xs hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 ${
                      action.danger ? "text-red-400" : "text-zinc-300"
                    }`}
                    onClick={action.onClick}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon className="size-3.5 shrink-0" />
                      {action.label}
                    </span>
                  </button>
                  {action.separatorAfter ? (
                    <div className="mx-2 my-0.5 h-px bg-white/10" />
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
