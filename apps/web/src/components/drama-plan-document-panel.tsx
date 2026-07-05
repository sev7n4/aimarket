"use client";

import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { Loader2, Palette, Sparkles, Users } from "lucide-react";
import type { DramaPlanStreamEvent } from "@/lib/drama-plan-stream";
import type { DramaProjectPayload } from "@/lib/types";
import { fetchDramaVoices } from "@/lib/api-client";
import { allCharactersLockedForProduce } from "@/lib/drama-character-helpers";
import { DramaScriptCard } from "@/components/drama/drama-script-card";
import { DramaSceneCardView } from "@/components/drama/drama-scene-card";
import { DramaCharacterCardView } from "@/components/drama-character-card";
import { DramaStoryboardGrid } from "@/components/drama-storyboard-grid";
import { DramaBadge } from "@/components/drama/drama-badge";
import { DramaAssetRegenPopover } from "@/components/drama/drama-asset-regen-popover";

interface DramaPlanDocumentPanelProps {
  partialProject?: DramaProjectPayload | null;
  projectId?: string;
  readOnly?: boolean;
  busy?: boolean;
  currentAgent?: string | null;
  events?: DramaPlanStreamEvent[];
  status?: "planning" | "completed" | "failed";
  planTitle?: string;
  onProjectUpdate?: (project: DramaProjectPayload) => void;
  onSaveProject?: (project: DramaProjectPayload) => Promise<void>;
  onRefinePlan?: (instruction: string) => Promise<unknown>;
  onConfirmProduce?: () => void;
  produceBusy?: boolean;
  produceHint?: string | null;
  confirmDisabled?: boolean;
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

function DocSection({
  title,
  loading,
  emptyHint,
  testId,
  children,
}: {
  title: string;
  loading?: boolean;
  emptyHint?: string;
  testId: string;
  children?: ReactNode;
}) {
  const hasContent = children != null && children !== false;
  return (
    <section
      data-testid={testId}
      className="border-b border-white/5 pb-5 last:border-b-0 last:pb-0"
    >
      <header className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-100">
          {title}
        </h2>
        {loading ? (
          <Loader2 className="size-3.5 animate-spin text-orange-300/90" />
        ) : null}
      </header>
      {hasContent ? (
        children
      ) : (
        <p className="text-xs leading-relaxed text-zinc-600">
          {emptyHint ?? "等待 Agent 输出…"}
        </p>
      )}
    </section>
  );
}

function DramaStyleBlock({
  styleBible,
  editable,
  busy,
  onRefine,
}: {
  styleBible: DramaProjectPayload["styleBible"];
  editable?: boolean;
  busy?: boolean;
  onRefine?: (instruction: string) => Promise<void>;
}) {
  const [regenOpen, setRegenOpen] = useState(false);

  return (
    <>
      <div
        data-testid="drama-style-card"
        className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3"
      >
        <div className="flex items-start gap-2">
          <Palette className="mt-0.5 size-4 shrink-0 text-amber-300/80" />
          <div className="min-w-0 flex-1 space-y-1.5">
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
            {editable && onRefine ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setRegenOpen(true)}
                className="mt-1 inline-flex items-center gap-1 text-[10px] text-violet-300 hover:text-violet-200 disabled:opacity-50"
                data-testid="drama-style-refine"
              >
                <Sparkles className="size-3" />
                AI 迭代风格
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {onRefine ? (
        <DramaAssetRegenPopover
          open={regenOpen}
          title="迭代美术风格"
          placeholder="例如：赛博朋克霓虹、低饱和胶片、暖色逆光…"
          busy={busy}
          onClose={() => setRegenOpen(false)}
          onSubmit={onRefine}
        />
      ) : null}
    </>
  );
}

function hasScript(project: DramaProjectPayload): boolean {
  const { script } = project;
  return Boolean(
    script.title ||
      script.logline ||
      script.acts.length > 0 ||
      script.narratorLines.length > 0,
  );
}

function hasStyle(project: DramaProjectPayload): boolean {
  const s = project.styleBible;
  return Boolean(
    s.lightingStyle ||
      s.palette.length > 0 ||
      s.globalContextBlock ||
      s.negativePrompt,
  );
}

function assetGenErrors(events: DramaPlanStreamEvent[]) {
  const charErrors = new Map<string, string>();
  const sceneErrors = new Map<string, string>();
  for (const e of events) {
    if (e.type === "character_tool_failed" && e.tool === "turnaround") {
      charErrors.set(e.characterId, e.error ?? "生成失败");
    }
    if (e.type === "scene_tool_failed") {
      sceneErrors.set(e.sceneId, e.error ?? "生成失败");
    }
    if (e.type === "character_tool_done" && e.tool === "turnaround") {
      charErrors.delete(e.characterId);
    }
    if (e.type === "scene_tool_done") {
      sceneErrors.delete(e.sceneId);
    }
  }
  return { charErrors, sceneErrors };
}

export function DramaPlanDocumentPanel({
  partialProject,
  projectId,
  readOnly,
  busy,
  currentAgent,
  events = [],
  status = "planning",
  planTitle,
  onProjectUpdate,
  onSaveProject,
  onRefinePlan,
  onConfirmProduce,
  produceBusy,
  produceHint,
  confirmDisabled,
}: DramaPlanDocumentPanelProps) {
  const charactersLocked = partialProject
    ? allCharactersLockedForProduce(partialProject.characters)
    : false;

  const handleProjectUpdate = useCallback(
    (project: DramaProjectPayload) => {
      onProjectUpdate?.(project);
    },
    [onProjectUpdate],
  );

  const persistProject = useCallback(
    async (next: DramaProjectPayload) => {
      handleProjectUpdate(next);
      if (onSaveProject) await onSaveProject(next);
    },
    [handleProjectUpdate, onSaveProject],
  );

  const handleVoiceChange = useCallback(
    async (characterId: string, voiceId: string) => {
      if (!partialProject || readOnly) return;
      const voices = await fetchDramaVoices().catch(() => []);
      const voice = voices.find((v) => v.id === voiceId);
      const next: DramaProjectPayload = {
        ...partialProject,
        characters: partialProject.characters.map((c) =>
          c.id === characterId
            ? { ...c, voiceId, voiceStyle: voice?.label ?? c.voiceStyle }
            : c,
        ),
      };
      await persistProject(next);
    },
    [partialProject, readOnly, persistProject],
  );

  const patchScript = useCallback(
    async (patch: Partial<DramaProjectPayload["script"]>) => {
      if (!partialProject || readOnly) return;
      await persistProject({
        ...partialProject,
        script: { ...partialProject.script, ...patch },
      });
    },
    [partialProject, readOnly, persistProject],
  );

  const handleRefineScript = useCallback(
    async (instruction: string) => {
      if (!onRefinePlan) {
        throw new Error("当前无法发起 AI 迭代");
      }
      await onRefinePlan(`【剧本】${instruction}`);
    },
    [onRefinePlan],
  );

  const handleRefineStyle = useCallback(
    async (instruction: string) => {
      if (!onRefinePlan) {
        throw new Error("当前无法发起 AI 迭代");
      }
      await onRefinePlan(`【美术风格】${instruction}`);
    },
    [onRefinePlan],
  );

  const handleRefineStoryboard = useCallback(
    async (instruction: string) => {
      if (!onRefinePlan) {
        throw new Error("当前无法发起 AI 迭代");
      }
      await onRefinePlan(`【分镜】${instruction}`);
    },
    [onRefinePlan],
  );

  const handleRefineVoice = useCallback(
    async (characterId: string, instruction: string) => {
      if (!onRefinePlan || !partialProject) {
        throw new Error("当前无法发起 AI 迭代");
      }
      const name =
        partialProject.characters.find((c) => c.id === characterId)?.name ??
        characterId;
      await onRefinePlan(`【音色】角色「${name}」：${instruction}`);
    },
    [onRefinePlan, partialProject],
  );

  const { charErrors, sceneErrors } = useMemo(
    () => assetGenErrors(events),
    [events],
  );

  const handleLockCharacter = useCallback(
    async (characterId: string, lockStatus: "draft" | "locked") => {
      if (!partialProject || readOnly) return;
      const next: DramaProjectPayload = {
        ...partialProject,
        characters: partialProject.characters.map((c) =>
          c.id === characterId ? { ...c, turnaroundStatus: lockStatus } : c,
        ),
      };
      handleProjectUpdate(next);
      if (onSaveProject) await onSaveProject(next);
    },
    [partialProject, readOnly, handleProjectUpdate, onSaveProject],
  );

  const interactive = Boolean(projectId) && !readOnly;
  const canRefine = interactive && Boolean(onRefinePlan);
  const [storyboardRegenOpen, setStoryboardRegenOpen] = useState(false);
  const title =
    planTitle ??
    partialProject?.script?.title ??
    (status === "planning" ? "策划文档" : "短剧方案");

  const scriptLoading =
    status === "planning" && currentAgent === "writer" && !partialProject;
  const styleLoading =
    status === "planning" &&
    currentAgent === "director" &&
    (!partialProject || !hasStyle(partialProject));
  const charactersLoading =
    status === "planning" &&
    currentAgent === "character" &&
    (partialProject?.characters.length ?? 0) === 0;
  const storyboardLoading =
    status === "planning" &&
    currentAgent === "storyboard" &&
    (partialProject?.shots.length ?? 0) === 0;

  const showScript = partialProject && hasScript(partialProject);
  const showStyle = partialProject && hasStyle(partialProject);
  const showCharacters = (partialProject?.characters.length ?? 0) > 0;
  const showScenes = (partialProject?.scenes.length ?? 0) > 0;
  const showStoryboard = (partialProject?.shots.length ?? 0) > 0;

  return (
    <article
      data-testid="drama-plan-document-panel"
      className="flex h-full min-h-0 flex-col"
    >
      <header className="shrink-0 border-b border-white/5 px-4 py-3 sm:px-5">
        <h1 className="text-[15px] font-medium text-zinc-100">{title}</h1>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          {status === "planning"
            ? "右侧文档随 Agent 逐步填充"
            : status === "failed"
              ? "规划未完成"
              : "规划已定稿，可确认制作"}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        <div className="space-y-5">
          <DocSection
            title="剧本内容"
            loading={scriptLoading}
            emptyHint="编剧 Agent 撰写场次与对白…"
            testId="drama-artifact-script"
          >
            {showScript && partialProject ? (
              <>
                <DramaScriptCard
                  script={partialProject.script}
                  editable={interactive}
                  busy={busy}
                  onTitleChange={(title) => void patchScript({ title })}
                  onLoglineChange={(logline) => void patchScript({ logline })}
                  onActSummaryChange={(index, summary) => {
                    const acts = [...partialProject.script.acts];
                    acts[index] = { ...acts[index]!, summary };
                    void patchScript({ acts });
                  }}
                  onNarratorLineChange={(index, line) => {
                    const narratorLines = [...partialProject.script.narratorLines];
                    narratorLines[index] = line;
                    void patchScript({ narratorLines });
                  }}
                  onRefine={
                    interactive && onRefinePlan ? handleRefineScript : undefined
                  }
                />
                {agentReasoning(events, "writer") ? (
                  <pre className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/5 bg-black/30 p-2 text-[10px] leading-relaxed text-zinc-500">
                    {agentReasoning(events, "writer")}
                  </pre>
                ) : null}
              </>
            ) : null}
          </DocSection>

          <DocSection
            title="美术风格"
            loading={styleLoading}
            emptyHint="导演 Agent 定义视觉风格…"
            testId="drama-artifact-style"
          >
            {showStyle && partialProject ? (
              <DramaStyleBlock
                styleBible={partialProject.styleBible}
                editable={canRefine}
                busy={busy}
                onRefine={canRefine ? handleRefineStyle : undefined}
              />
            ) : null}
          </DocSection>

          <DocSection
            title="主体列表"
            loading={charactersLoading}
            emptyHint="角色 Agent 整理人物设定…"
            testId="drama-artifact-characters"
          >
            {showCharacters && partialProject ? (
              <>
                <div className="mb-2 flex items-center gap-1 text-[10px] text-zinc-500">
                  <Users className="size-3" />
                  {partialProject.characters.length} 个角色
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {partialProject.characters.map((character) => (
                    <DramaCharacterCardView
                      key={character.id}
                      character={character}
                      projectId={projectId ?? ""}
                      readOnly={!interactive}
                      busy={busy}
                      onProjectUpdate={handleProjectUpdate}
                      onLockCharacter={
                        interactive && onSaveProject
                          ? handleLockCharacter
                          : undefined
                      }
                      onVoiceChange={
                        interactive && onSaveProject ? handleVoiceChange : undefined
                      }
                      onVoiceRefine={
                        canRefine ? handleRefineVoice : undefined
                      }
                      genError={charErrors.get(character.id) ?? null}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </DocSection>

          <DocSection
            title="场景列表"
            emptyHint="场景随剧本场次生成…"
            testId="drama-artifact-scenes"
          >
            {showScenes && partialProject ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {partialProject.scenes.map((scene) => (
                  <DramaSceneCardView
                    key={scene.id}
                    scene={scene}
                    projectId={projectId}
                    readOnly={!interactive}
                    busy={busy}
                    onProjectUpdate={
                      interactive ? handleProjectUpdate : undefined
                    }
                    genError={sceneErrors.get(scene.id) ?? null}
                  />
                ))}
              </div>
            ) : null}
          </DocSection>

          <DocSection
            title="分镜剧本"
            loading={storyboardLoading}
            emptyHint="分镜 Agent 编排镜头…"
            testId="drama-artifact-storyboard"
          >
            {showStoryboard && partialProject ? (
              <>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-zinc-500">
                    {partialProject.shots.length} 镜 ·{" "}
                    {partialProject.script.acts.length} 幕
                  </p>
                  {canRefine ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setStoryboardRegenOpen(true)}
                      className="inline-flex items-center gap-1 text-[10px] text-violet-300 hover:text-violet-200 disabled:opacity-50"
                      data-testid="drama-storyboard-refine"
                    >
                      <Sparkles className="size-3" />
                      AI 迭代分镜
                    </button>
                  ) : null}
                </div>
                <DramaStoryboardGrid
                  shots={partialProject.shots}
                  readOnly={!interactive}
                  editable={interactive}
                  onShotsChange={
                    interactive
                      ? (shots) =>
                          void persistProject({ ...partialProject, shots })
                      : undefined
                  }
                />
                {canRefine ? (
                  <DramaAssetRegenPopover
                    open={storyboardRegenOpen}
                    title="迭代分镜剧本"
                    placeholder="例如：增加一个反转镜头，第二镜改为特写…"
                    busy={busy}
                    onClose={() => setStoryboardRegenOpen(false)}
                    onSubmit={handleRefineStoryboard}
                  />
                ) : null}
              </>
            ) : null}
          </DocSection>
        </div>
      </div>

      {status === "completed" && onConfirmProduce ? (
        <footer className="shrink-0 border-t border-white/10 px-4 py-3 sm:px-5">
          {!charactersLocked ? (
            <p
              className="mb-2 text-[11px] text-amber-400/90"
              data-testid="drama-characters-lock-hint"
            >
              请为所有角色生成三视图并确认定稿后再开始制作
            </p>
          ) : null}
          {produceHint ? (
            <p className="mb-2 text-[10px] text-amber-300/90">{produceHint}</p>
          ) : null}
          <button
            type="button"
            data-testid="drama-confirm-produce"
            disabled={produceBusy || confirmDisabled || !charactersLocked}
            onClick={onConfirmProduce}
            className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {produceBusy ? "处理中…" : "确认分镜，开始制作"}
          </button>
        </footer>
      ) : null}
    </article>
  );
}
