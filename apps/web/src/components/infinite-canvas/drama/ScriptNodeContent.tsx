import { FileText } from "lucide-react";

import { DramaAssetCardShell } from "@/components/drama/drama-asset-card-shell";
import { DramaBadge } from "@/components/drama/drama-badge";
import { canvasTheme } from "../canvas-theme";
import type { CanvasNodeData } from "../types";

type ScriptNodeContentProps = {
  node: CanvasNodeData;
};

export function ScriptNodeContent({ node }: ScriptNodeContentProps) {
  const m = node.metadata;
  const title = m?.scriptTitle || node.title || "未命名剧本";
  const logline = m?.logline;
  const actCount = m?.actCount;
  const narratorLineCount = m?.narratorLineCount;
  const actSummaries = m?.actSummaries;

  return (
    <DramaAssetCardShell
      category="script"
      compact
      testId="drama-canvas-script-card"
      badges={
        <>
          {actCount != null && actCount > 0 ? (
            <DramaBadge color="#8b5cf6">{actCount} 幕</DramaBadge>
          ) : null}
          {narratorLineCount != null && narratorLineCount > 0 ? (
            <DramaBadge color="#6366f1">{narratorLineCount} 旁白</DramaBadge>
          ) : null}
        </>
      }
    >
      <div className="flex items-start gap-2">
        <FileText
          className="mt-0.5 size-4 shrink-0 opacity-60"
          style={{ color: canvasTheme.node.muted }}
        />
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-sm font-bold leading-snug"
            style={{ color: canvasTheme.node.text }}
          >
            {title}
          </div>
          {logline ? (
            <div
              className="mt-1 line-clamp-3 text-xs leading-relaxed"
              style={{ color: canvasTheme.node.faint }}
            >
              {logline}
            </div>
          ) : null}
        </div>
      </div>

      {actSummaries && actSummaries.length > 0 ? (
        <div className="space-y-1 border-t border-white/5 pt-2">
          {actSummaries.slice(0, 2).map((summary, i) => (
            <div
              key={i}
              className="line-clamp-2 rounded-md px-2 py-1 text-[11px] leading-relaxed"
              style={{
                background: "rgba(139, 92, 246, 0.08)",
                color: canvasTheme.node.muted,
              }}
            >
              {summary}
            </div>
          ))}
        </div>
      ) : null}
    </DramaAssetCardShell>
  );
}
