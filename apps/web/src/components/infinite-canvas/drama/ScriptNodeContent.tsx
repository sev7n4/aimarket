import React, { type ReactNode } from "react";
import { FileText } from "lucide-react";

import type { CanvasNodeData } from "../types";
import { canvasTheme } from "../canvas-theme";
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

type ScriptNodeContentProps = {
  node: CanvasNodeData;
};

export function ScriptNodeContent({ node }: ScriptNodeContentProps) {
  const m = node.metadata;
  const title = m?.scriptTitle || node.title || "未命名剧本";
  const logline = m?.logline;
  const actCount = m?.actCount;
  const narratorLineCount = m?.narratorLineCount;

  return (
    <div className="flex h-full w-full flex-col gap-2.5 p-4">
      {/* Header icon + title */}
      <div className="flex items-start gap-2">
        <FileText
          className="mt-0.5 size-4 shrink-0"
          style={{ color: canvasTheme.node.muted }}
        />
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-sm font-bold leading-snug"
            style={{ color: canvasTheme.node.text }}
          >
            {title}
          </div>
          {logline && (
            <div
              className="mt-1 line-clamp-2 text-xs leading-relaxed"
              style={{ color: canvasTheme.node.faint }}
            >
              {logline}
            </div>
          )}
        </div>
      </div>

      {/* Badge row */}
      {(actCount != null || narratorLineCount != null) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {actCount != null && (
            <Badge color="#8b5cf6">{actCount} 幕</Badge>
          )}
          {narratorLineCount != null && (
            <Badge color="#6366f1">{narratorLineCount} 旁白</Badge>
          )}
        </div>
      )}
    </div>
  );
}
