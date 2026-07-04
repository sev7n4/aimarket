"use client";

import { DramaAssetCardShell } from "@/components/drama/drama-asset-card-shell";
import { DramaBadge } from "@/components/drama/drama-badge";
import type { DramaProjectPayload } from "@/lib/types";

type DramaScriptCardProps = {
  script: DramaProjectPayload["script"];
  editable?: boolean;
  onTitleChange?: (title: string) => void;
  onLoglineChange?: (logline: string) => void;
  onActSummaryChange?: (index: number, summary: string) => void;
};

/** Agent 面板：剧本资产卡片 */
export function DramaScriptCard({
  script,
  editable,
  onTitleChange,
  onLoglineChange,
  onActSummaryChange,
}: DramaScriptCardProps) {
  const actCount = script.acts.length;
  const narratorCount = script.narratorLines.length;

  return (
    <DramaAssetCardShell
      category="script"
      testId="drama-script-card"
      className="rounded-lg border border-white/10 bg-black/20"
      badges={
        <>
          {actCount > 0 ? (
            <DramaBadge color="#8b5cf6">{actCount} 幕</DramaBadge>
          ) : null}
          {narratorCount > 0 ? (
            <DramaBadge color="#6366f1">{narratorCount} 旁白</DramaBadge>
          ) : null}
        </>
      }
    >
      {editable ? (
        <>
          <input
            className="w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm font-medium text-zinc-100"
            value={script.title}
            onChange={(e) => onTitleChange?.(e.target.value)}
            placeholder="短剧标题"
          />
          <textarea
            className="w-full resize-none rounded border border-white/10 bg-black/30 px-2 py-1.5 text-xs leading-relaxed text-zinc-400"
            rows={2}
            value={script.logline}
            onChange={(e) => onLoglineChange?.(e.target.value)}
            placeholder="一句话梗概"
          />
        </>
      ) : (
        <>
          <div className="text-sm font-semibold leading-snug text-zinc-100">
            {script.title || "AI 短剧"}
          </div>
          {script.logline ? (
            <p className="text-xs leading-relaxed text-zinc-400">
              {script.logline}
            </p>
          ) : null}
        </>
      )}

      {script.acts.length > 0 ? (
        <div className="space-y-1.5 pt-1">
          <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            场次大纲
          </div>
          {script.acts.slice(0, editable ? script.acts.length : 3).map((act, i) => (
            <div
              key={`${act.act}-${act.sceneId}`}
              className="rounded-md border border-white/10 bg-black/20 p-2"
            >
              <div className="mb-1 text-[10px] font-medium text-violet-300/80">
                第 {act.act} 幕
              </div>
              {editable ? (
                <textarea
                  className="w-full resize-none rounded border border-white/10 bg-black/30 p-1 text-xs text-zinc-300"
                  rows={2}
                  value={act.summary}
                  onChange={(e) => onActSummaryChange?.(i, e.target.value)}
                />
              ) : (
                <p className="line-clamp-2 text-xs leading-relaxed text-zinc-400">
                  {act.summary}
                </p>
              )}
            </div>
          ))}
          {!editable && script.acts.length > 3 ? (
            <div className="text-[10px] text-zinc-600">
              还有 {script.acts.length - 3} 幕…
            </div>
          ) : null}
        </div>
      ) : null}
    </DramaAssetCardShell>
  );
}
