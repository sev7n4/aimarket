import React, { type ReactNode } from "react";
import { User } from "lucide-react";

import type { CanvasNodeData } from "../types";
import { canvasTheme } from "../canvas-theme";
import { cn } from "@aimarket/ui";

function Badge({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
      style={{ background: `${color}22`, color }}
    >
      {children}
    </span>
  );
}

const roleLabels: Record<string, string> = {
  protagonist: "主角",
  supporting: "配角",
};

const turnaroundColors: Record<string, string> = {
  draft: "#eab308",
  locked: "#22c55e",
};

const turnaroundLabels: Record<string, string> = {
  draft: "草稿",
  locked: "已锁定",
};

type CharacterNodeContentProps = {
  node: CanvasNodeData;
};

export function CharacterNodeContent({ node }: CharacterNodeContentProps) {
  const m = node.metadata;
  const name = m?.characterName || node.title || "未命名角色";
  const role = m?.characterRole;
  const personalityTone = m?.personalityTone;
  const promptAnchor = m?.promptAnchor;
  const turnaroundStatus = m?.turnaroundStatus;
  const refUrl = m?.refUrl;

  return (
    <div className="flex h-full w-full flex-col gap-2 p-3">
      {/* Name + icon */}
      <div className="flex items-center gap-2">
        <User
          className="size-4 shrink-0"
          style={{ color: canvasTheme.node.muted }}
        />
        <div
          className="truncate text-sm font-bold leading-snug"
          style={{ color: canvasTheme.node.text }}
        >
          {name}
        </div>
      </div>

      {/* Role + turnaround badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        {role && (
          <Badge color="#8b5cf6">
            {roleLabels[role] || role}
          </Badge>
        )}
        {turnaroundStatus && (
          <Badge color={turnaroundColors[turnaroundStatus] || "#78716c"}>
            {turnaroundLabels[turnaroundStatus] || turnaroundStatus}
          </Badge>
        )}
      </div>

      {/* Personality tone */}
      {personalityTone && (
        <div
          className="line-clamp-1 text-xs leading-snug"
          style={{ color: canvasTheme.node.faint }}
        >
          {personalityTone}
        </div>
      )}

      {/* Prompt anchor */}
      {promptAnchor && (
        <div
          className="line-clamp-1 truncate font-mono text-[11px] leading-snug"
          style={{ color: canvasTheme.node.faint }}
        >
          {promptAnchor}
        </div>
      )}

      {/* Ref image thumbnail */}
      {refUrl && (
        <div
          className="mt-auto aspect-video w-full overflow-hidden rounded-md"
          style={{ background: canvasTheme.node.panel }}
        >
          <img
            src={refUrl}
            alt={name}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            className="pointer-events-none size-full select-none object-cover"
          />
        </div>
      )}
    </div>
  );
}
