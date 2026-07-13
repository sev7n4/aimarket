"use client";

import type { MouseEvent } from "react";
import { Scissors } from "lucide-react";

import { canvasTheme } from "./canvas-theme";

type ConnectionScissorsProps = {
  x: number;
  y: number;
  onDelete: () => void;
};

export function ConnectionScissors({ x, y, onDelete }: ConnectionScissorsProps) {
  const theme = canvasTheme;

  return (
    <button
      type="button"
      data-testid="connection-scissors"
      className="absolute z-40 flex size-7 cursor-pointer items-center justify-center rounded-full border shadow-md transition hover:scale-110"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
        background: theme.toolbar.panel,
        borderColor: theme.node.activeStroke,
        color: theme.node.activeStroke,
      }}
      title="删除连线"
      aria-label="删除连线"
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event: MouseEvent) => {
        event.stopPropagation();
        onDelete();
      }}
    >
      <Scissors className="size-3.5" />
    </button>
  );
}
