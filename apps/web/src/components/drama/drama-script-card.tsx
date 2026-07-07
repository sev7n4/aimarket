"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import {
  DramaScriptCardShell,
  dramaScriptDisplayFromPayload,
} from "@/components/drama/drama-script-card-shell";
import { DramaAssetRegenPopover } from "@/components/drama/drama-asset-regen-popover";
import type { DramaProjectPayload } from "@/lib/types";

type DramaScriptCardProps = {
  script: DramaProjectPayload["script"];
  editable?: boolean;
  busy?: boolean;
  onTitleChange?: (title: string) => void;
  onLoglineChange?: (logline: string) => void;
  onActSummaryChange?: (index: number, summary: string) => void;
  onNarratorLineChange?: (index: number, line: string) => void;
  /** Studio 提示词迭代剧本 */
  onRefine?: (instruction: string) => Promise<void>;
};

/** Agent 面板：剧本资产卡片（可编辑 + AI 迭代） */
export function DramaScriptCard({
  script,
  editable,
  busy,
  onTitleChange,
  onLoglineChange,
  onActSummaryChange,
  onNarratorLineChange,
  onRefine,
}: DramaScriptCardProps) {
  const [regenOpen, setRegenOpen] = useState(false);

  const editableBody = editable ? (
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
      {script.acts.length > 0 ? (
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
              <textarea
                className="w-full resize-none rounded border border-white/10 bg-black/30 p-1 text-xs text-zinc-300"
                rows={2}
                value={act.summary}
                onChange={(e) => onActSummaryChange?.(i, e.target.value)}
              />
            </div>
          ))}
        </div>
      ) : null}
      {script.narratorLines.length > 0 ? (
        <div className="space-y-1 pt-1">
          <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            旁白
          </div>
          {script.narratorLines.map((line, i) =>
            onNarratorLineChange ? (
              <textarea
                key={i}
                className="w-full resize-none rounded border border-white/10 bg-black/30 p-1 text-[11px] text-zinc-400"
                rows={2}
                value={line}
                onChange={(e) => onNarratorLineChange(i, e.target.value)}
              />
            ) : (
              <p key={i} className="text-[11px] leading-relaxed text-zinc-500">
                {line}
              </p>
            ),
          )}
        </div>
      ) : null}
    </>
  ) : undefined;

  return (
    <>
      <DramaScriptCardShell
        mode="panel"
        script={dramaScriptDisplayFromPayload(script)}
        testId="drama-script-card"
        className="rounded-lg border border-white/10 bg-black/20"
        footer={
          editable && onRefine ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setRegenOpen(true)}
              className="inline-flex items-center gap-1 text-[10px] text-violet-300 hover:text-violet-200 disabled:opacity-50"
              data-testid="drama-script-refine"
            >
              <Sparkles className="size-3" />
              AI 迭代剧本
            </button>
          ) : null
        }
      >
        {editableBody}
      </DramaScriptCardShell>

      {onRefine ? (
        <DramaAssetRegenPopover
          open={regenOpen}
          title="迭代剧本"
          placeholder="例如：把第二幕改成雨夜对峙，增加反转…"
          busy={busy}
          onClose={() => setRegenOpen(false)}
          onSubmit={onRefine}
        />
      ) : null}
    </>
  );
}
