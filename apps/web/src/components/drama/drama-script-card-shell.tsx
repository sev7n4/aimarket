"use client";

import type { ReactNode } from "react";
import { FileText } from "lucide-react";

import { DramaAssetCardShell } from "@/components/drama/drama-asset-card-shell";
import { DramaBadge } from "@/components/drama/drama-badge";
import { canvasTheme } from "@/components/infinite-canvas/canvas-theme";
import type { CanvasNodeData } from "@/components/infinite-canvas/types";
import type { DramaProjectPayload } from "@/lib/types";

export type DramaScriptActDisplay = {
  act: number;
  sceneId?: string;
  summary: string;
  emotion?: string;
};

export type DramaScriptCardDisplay = {
  title: string;
  logline?: string;
  actCount?: number;
  narratorLineCount?: number;
  /** 画布节点：幕摘要摘要列表 */
  actSummaries?: string[];
  /** 面板只读：完整幕结构 */
  acts?: DramaScriptActDisplay[];
  narratorLines?: string[];
};

export type DramaScriptCardShellProps = {
  mode: "panel" | "node";
  script: DramaScriptCardDisplay;
  testId?: string;
  className?: string;
  footer?: ReactNode;
  /** 面板可编辑态：由父组件注入表单 */
  children?: ReactNode;
};

export function dramaScriptDisplayFromPayload(
  script: DramaProjectPayload["script"],
): DramaScriptCardDisplay {
  return {
    title: script.title || "AI 短剧",
    logline: script.logline,
    actCount: script.acts.length,
    narratorLineCount: script.narratorLines.length,
    acts: script.acts.map((act) => ({
      act: act.act,
      sceneId: act.sceneId,
      summary: act.summary,
      emotion: act.emotion,
    })),
    narratorLines: script.narratorLines,
  };
}

export function dramaScriptDisplayFromNode(
  node: CanvasNodeData,
): DramaScriptCardDisplay {
  const m = node.metadata;
  return {
    title: m?.scriptTitle || node.title || "未命名剧本",
    logline: m?.logline,
    actCount: m?.actCount,
    narratorLineCount: m?.narratorLineCount,
    actSummaries: m?.actSummaries,
  };
}

function scriptBadges(script: DramaScriptCardDisplay): ReactNode {
  const actCount = script.actCount ?? script.acts?.length ?? 0;
  const narratorCount =
    script.narratorLineCount ?? script.narratorLines?.length ?? 0;
  return (
    <>
      {actCount > 0 ? (
        <DramaBadge color="#8b5cf6">{actCount} 幕</DramaBadge>
      ) : null}
      {narratorCount > 0 ? (
        <DramaBadge color="#6366f1">{narratorCount} 旁白</DramaBadge>
      ) : null}
    </>
  );
}

function nodeScriptBody(script: DramaScriptCardDisplay): ReactNode {
  return (
    <>
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
            {script.title}
          </div>
          {script.logline ? (
            <div
              className="mt-1 line-clamp-3 text-xs leading-relaxed"
              style={{ color: canvasTheme.node.faint }}
            >
              {script.logline}
            </div>
          ) : null}
        </div>
      </div>
      {script.actSummaries && script.actSummaries.length > 0 ? (
        <div className="space-y-1 border-t border-white/5 pt-2">
          {script.actSummaries.slice(0, 2).map((summary, i) => (
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
    </>
  );
}

function panelReadonlyBody(script: DramaScriptCardDisplay): ReactNode {
  return (
    <>
      <div className="text-sm font-semibold leading-snug text-zinc-100">
        {script.title}
      </div>
      {script.logline ? (
        <p className="text-xs leading-relaxed text-zinc-400">{script.logline}</p>
      ) : null}
      {script.acts && script.acts.length > 0 ? (
        <div className="space-y-1.5 pt-1">
          <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            场次大纲
          </div>
          {script.acts.map((act, i) => (
            <div
              key={`${act.act}-${act.sceneId}-${i}`}
              className="rounded-md border border-white/10 bg-black/20 p-2"
            >
              <div className="mb-1 text-[10px] font-medium text-violet-300/80">
                第 {act.act} 幕
                {act.emotion ? (
                  <span className="ml-1 text-zinc-500">· {act.emotion}</span>
                ) : null}
              </div>
              <p className="text-xs leading-relaxed text-zinc-400">
                {act.summary}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      {script.narratorLines && script.narratorLines.length > 0 ? (
        <div className="space-y-1 pt-1">
          <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            旁白
          </div>
          {script.narratorLines.map((line, i) => (
            <p key={i} className="text-[11px] leading-relaxed text-zinc-500">
              {line}
            </p>
          ))}
        </div>
      ) : null}
    </>
  );
}

export function DramaScriptCardShell({
  mode,
  script,
  testId,
  className,
  footer,
  children,
}: DramaScriptCardShellProps) {
  const compact = mode === "node";
  const body =
    children ??
    (mode === "node" ? nodeScriptBody(script) : panelReadonlyBody(script));

  return (
    <DramaAssetCardShell
      category="script"
      compact={compact}
      testId={testId}
      className={className}
      badges={scriptBadges(script)}
      footer={footer}
    >
      {body}
    </DramaAssetCardShell>
  );
}
