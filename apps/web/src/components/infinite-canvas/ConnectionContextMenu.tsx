"use client";

import { useEffect } from "react";
import { Trash2 } from "lucide-react";
import { canvasTheme } from "./canvas-theme";

interface ConnectionContextMenuProps {
  x: number;
  y: number;
  onDelete: () => void;
  onClose: () => void;
}

export function ConnectionContextMenu({
  x,
  y,
  onDelete,
  onClose,
}: ConnectionContextMenuProps) {
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-testid="connection-context-menu"]')) {
        onClose();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      data-testid="connection-context-menu"
      className="fixed z-[120] min-w-[140px] rounded-lg border py-1 shadow-xl"
      style={{
        left: x,
        top: y,
        borderColor: canvasTheme.toolbar.border,
        background: canvasTheme.toolbar.panel,
      }}
    >
      <button
        type="button"
        data-testid="connection-context-delete"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-300 hover:bg-white/5"
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        <Trash2 className="h-4 w-4 shrink-0" />
        删除连线
      </button>
    </div>
  );
}
