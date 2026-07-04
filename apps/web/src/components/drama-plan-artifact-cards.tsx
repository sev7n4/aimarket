"use client";

import { useMemo, type ReactNode } from "react";
import { Check, Loader2, Palette, Users } from "lucide-react";
import type { DramaPlanStreamEvent } from "@/lib/drama-plan-stream";
import type { DramaProjectPayload } from "@/lib/types";
import { DramaScriptCard } from "@/components/drama/drama-script-card";
import { DramaSceneCardView } from "@/components/drama/drama-scene-card";
import { DramaCharacterCardView } from "@/components/drama-character-card";
import { DramaStoryboardGrid } from "@/components/drama-storyboard-grid";
import { DramaAssetCardShell } from "@/components/drama/drama-asset-card-shell";
import { DramaBadge } from "@/components/drama/drama-badge";
import {
  DRAMA_PLAN_AGENT_META,
} from "@/components/drama-plan-timeline";

interface DramaPlanArtifactCardsProps {
  prompt: string;
  currentAgent?: string | null;
  events: DramaPlanStreamEvent[];
  partialProject?: DramaProjectPayload | null;
  status?: "planning" | "completed" | "failed";
  error?: string | null;
  onRerunFromAgent?: (agent: string) => void;
  rerunBusy?: boolean;
}

function doneAgents(events: DramaPlanStreamEvent[]): Set<string> {
  return new Set(
    events
      .filter((e) => e.type === "agent_done")
      .map((e) => (e.type === "agent_done" ? e.agent : "")),
  );
}

function agentReasoning(
  events: DramaPlanStreamEvent[],
  agent: string,
): string | undefined {
  const chunks = events
    .filter((e) => e.type === "agent_reasoning" && e.agent === agent)
    .map((e) => (e.type === "agent_reasoning" ? e.chunk : ""));
  return chunks.length ? chunks.join("\n") : undefined;
}

function SectionShell({
  title,
  loading,
  testId,
  children,
}: {
  title: string;
  loading?: boolean;
  testId: string;
  children: ReactNode;
}) {
  return (
    <section
      data-testid={testId}
      className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 sm:px-4"
    >
      <header className="mb-2 flex items-center gap-2">
        {loading ? (
          <Loader2 className="size-3.5 animate-spin text-orange-300" />
        ) : (
          <Check className="size-3.5 text-emerald-400" />
        )}
        <h4 className="text-[13px] font-medium text-zinc-100">{title}</h4>
      </header>
      {children}
    </section>
  );
}

function DramaStyleCard({ styleBible }: { styleBible: DramaProjectPayload["styleBible"] }) {
  return (
    <div
      data-testid="drama-style-card"
      className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3"
    >
      <div className="flex items-start gap-2">
        <Palette className="mt-0.5 size-4 shrink-0 text-amber-300/80" />
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-zinc-100">
              {styleBible.lightingStyle || "美术风格"}
            </p>
            {styleBible.aspectRatio ? (
              <DramaBadge color="#f59e0b">{styleBible.aspectRatio}</DramaBadge>
            ) : null}
          </div>
          {styleBible.palette.length > 0 ? (
            <p className="text-xs text-zinc-400">
              色调：{styleBible.palette.join("、")}
            </p>
          ) : null}
          {styleBible.globalContextBlock ? (
            <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-500">
              {styleBible.globalContextBlock}
            </p>
          ) : null}
          {styleBible.negativePrompt ? (
            <p className="text-[10px] text-zinc-600">
              负向：{styleBible.negativePrompt}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function DramaPlanArtifactCards({
  prompt,
  currentAgent,
  events,
  partialProject,
  status = "planning",
  error,
  onRerunFromAgent,
  rerunBusy,
}: DramaPlanArtifactCardsProps) {
  const completed = doneAgents(events);
  const canRerun = status === "completed" || status === "failed";

  const showScript = completed.has("writer") && partialProject?.script;
  const showStyle = completed.has("director") && partialProject?.styleBible;
  const showCharacters =
    completed.has("character") && (partialProject?.characters.length ?? 0) > 0;
  const showScenes =
    completed.has("writer") && (partialProject?.scenes.length ?? 0) > 0;
  const showStoryboard =
    completed.has("storyboard") && (partialProject?.shots.length ?? 0) > 0;

  const activeAgent = useMemo(() => {
    if (status !== "planning") return null;
    return currentAgent ?? null;
  }, [status, currentAgent]);

  return (
    <article
      data-testid="drama-plan-timeline"
      className="space-y-3 rounded-xl border border-violet-500/20 bg-violet-500/[0.04] px-3 py-3 sm:px-4"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-medium text-violet-200">
          AI 短剧 · Agent 产物流
        </h3>
        <span className="text-[11px] text-zinc-500">
          {status === "planning"
            ? "规划进行中"
            : status === "failed"
              ? "规划失败"
              : "规划完成"}
        </span>
      </header>

      {prompt ? (
        <p className="line-clamp-2 text-[12px] leading-relaxed text-zinc-500">
          {prompt}
        </p>
      ) : null}

      <nav
        className="flex items-start gap-0 overflow-x-auto pb-1"
        data-testid="drama-plan-stepper"
        aria-label="规划进度"
      >
        {DRAMA_PLAN_AGENT_META.map((meta, i) => {
          const done = completed.has(meta.id);
          const current = activeAgent === meta.id && !done;
          return (
            <div key={meta.id} className="flex min-w-0 flex-1 items-center">
              <div
                className="flex flex-col items-center gap-1"
                data-testid={`drama-plan-step-${meta.id}`}
              >
                <span
                  className={`flex size-3 shrink-0 items-center justify-center rounded-full ${
                    current
                      ? "bg-orange-500 ring-2 ring-orange-500/30"
                      : done
                        ? "bg-emerald-500"
                        : "bg-white/15"
                  }`}
                />
                <span
                  className={`max-w-[3.5rem] truncate text-center text-[9px] leading-tight ${
                    current
                      ? "font-medium text-orange-200"
                      : done
                        ? "text-emerald-300/90"
                        : "text-zinc-600"
                  }`}
                >
                  {meta.label}
                </span>
              </div>
              {i < DRAMA_PLAN_AGENT_META.length - 1 ? (
                <div
                  className={`mx-0.5 mt-1.5 h-px min-w-2 flex-1 ${
                    done ? "bg-emerald-500/40" : "bg-white/10"
                  }`}
                />
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="space-y-3" data-testid="drama-plan-artifact-stream">
        {activeAgent === "writer" && !showScript ? (
          <SectionShell title="剧本内容" loading testId="drama-artifact-script-loading">
            <p className="text-xs text-zinc-500">编剧 Agent 正在撰写场次与对白…</p>
          </SectionShell>
        ) : null}

        {showScript && partialProject ? (
          <SectionShell title="剧本内容" testId="drama-artifact-script">
            <DramaScriptCard script={partialProject.script} />
            {agentReasoning(events, "writer") ? (
              <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/5 bg-black/30 p-2 text-[10px] leading-relaxed text-zinc-500">
                {agentReasoning(events, "writer")}
              </pre>
            ) : null}
          </SectionShell>
        ) : null}

        {showScenes && partialProject ? (
          <SectionShell title="场景列表" testId="drama-artifact-scenes">
            <div className="grid gap-2 sm:grid-cols-2">
              {partialProject.scenes.map((scene) => (
                <DramaSceneCardView key={scene.id} scene={scene} readOnly />
              ))}
            </div>
          </SectionShell>
        ) : null}

        {activeAgent === "director" && !showStyle ? (
          <SectionShell title="美术风格" loading testId="drama-artifact-style-loading">
            <p className="text-xs text-zinc-500">导演 Agent 正在定义视觉风格…</p>
          </SectionShell>
        ) : null}

        {showStyle && partialProject ? (
          <SectionShell title="美术风格" testId="drama-artifact-style">
            <DramaStyleCard styleBible={partialProject.styleBible} />
          </SectionShell>
        ) : null}

        {activeAgent === "character" && !showCharacters ? (
          <SectionShell title="主体列表" loading testId="drama-artifact-characters-loading">
            <p className="text-xs text-zinc-500">角色 Agent 正在整理人物设定…</p>
          </SectionShell>
        ) : null}

        {showCharacters && partialProject ? (
          <SectionShell title="主体列表" testId="drama-artifact-characters">
            <div className="mb-2 flex items-center gap-1 text-[10px] text-zinc-500">
              <Users className="size-3" />
              {partialProject.characters.length} 个角色 · 定稿后可生成三视图
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {partialProject.characters.map((character) => (
                <DramaCharacterCardView
                  key={character.id}
                  character={character}
                  projectId=""
                  readOnly
                  onProjectUpdate={() => {}}
                />
              ))}
            </div>
          </SectionShell>
        ) : null}

        {activeAgent === "storyboard" && !showStoryboard ? (
          <SectionShell title="分镜剧本" loading testId="drama-artifact-storyboard-loading">
            <p className="text-xs text-zinc-500">分镜 Agent 正在编排镜头…</p>
          </SectionShell>
        ) : null}

        {showStoryboard && partialProject ? (
          <SectionShell title="分镜剧本" testId="drama-artifact-storyboard">
            <p className="mb-2 text-[11px] text-zinc-500">
              剧本摘要 · {partialProject.script.acts.length} 幕 ·{" "}
              {partialProject.shots.length} 镜
            </p>
            <DramaStoryboardGrid shots={partialProject.shots} readOnly />
          </SectionShell>
        ) : null}
      </div>

      {canRerun && onRerunFromAgent ? (
        <div className="flex flex-wrap gap-2 border-t border-white/5 pt-2">
          {DRAMA_PLAN_AGENT_META.filter((m) => completed.has(m.id)).map(
            (meta) => (
              <button
                key={meta.id}
                type="button"
                disabled={rerunBusy}
                data-testid={`drama-plan-rerun-${meta.id}`}
                className="rounded border border-violet-500/30 px-2 py-0.5 text-[10px] text-violet-300 hover:bg-violet-500/10 disabled:opacity-50"
                onClick={() => onRerunFromAgent(meta.id)}
              >
                从{meta.label}重跑
              </button>
            ),
          )}
        </div>
      ) : null}

      {error ? (
        <p className="text-[10px] text-red-400/90">{error}</p>
      ) : null}
    </article>
  );
}
