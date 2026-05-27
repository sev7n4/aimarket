"use client";

import type { CanvasItem, CanvasItemRole } from "@/lib/canvas-tools";
import { CANVAS_ROLE_LABELS, assignCanvasItemRole } from "@/lib/canvas-roles";

interface CanvasRoleActionsProps {
  item: CanvasItem | null;
  readOnly?: boolean;
  onAssignRole: (itemId: string, role: CanvasItemRole) => void;
}

export function CanvasRoleActions({
  item,
  readOnly = false,
  onAssignRole,
}: CanvasRoleActionsProps) {
  if (!item || readOnly || item.source === "generation") return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs backdrop-blur-sm">
      <span className="text-zinc-500">画布素材：</span>
      <button
        type="button"
        onClick={() => onAssignRole(item.id, "product")}
        className={`rounded-full px-2.5 py-1 transition ${
          item.role === "product"
            ? "bg-orange-500 text-black"
            : "border border-white/10 text-zinc-300 hover:border-orange-500/40"
        }`}
      >
        {CANVAS_ROLE_LABELS.product}
      </button>
      <button
        type="button"
        onClick={() => onAssignRole(item.id, "reference")}
        className={`rounded-full px-2.5 py-1 transition ${
          item.role === "reference"
            ? "bg-violet-500 text-white"
            : "border border-white/10 text-zinc-300 hover:border-violet-500/40"
        }`}
      >
        {CANVAS_ROLE_LABELS.reference}
      </button>
    </div>
  );
}

export { assignCanvasItemRole };
