"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import { DramaCharacterCardView } from "@/components/drama-character-card";
import { DramaNodeGraph, type DramaNodeRerunPatch } from "@/components/drama-node-graph";
import { DramaStoryboardGrid } from "@/components/drama-storyboard-grid";
import { StudioReviewSidebar } from "@/components/studio-review-sidebar";
import { estimateDramaProjectPoints, fetchWorkspaceMembers, uploadAsset } from "@/lib/api-client";
import { allCharactersLockedForProduce } from "@/lib/drama-character-helpers";
import {
  activePipelineStep,
  computeProductionPercent,
  currentProductionLabel,
} from "@/lib/drama-production-helpers";
import { getActiveWorkspaceId } from "@/lib/active-workspace";
import { useAuth } from "@/lib/auth-context";
import type {
  DramaProject,
  DramaProjectPayload,
  DramaRun,
  DramaRunGraph,
} from "@/lib/types";

const DRAMA_CONFIRM_POINTS_THRESHOLD = 200;

const DRAMA_RUN_STATUS_LABEL: Record<string, string> = {
  queued: "排队中",
  running: "制作中",
  waiting_job: "等待生成任务",
  waiting_confirm: "待确认积分",
  completed: "已完成",
  failed: "制作失败",
  cancelled: "已取消",
};

interface DramaStudioPanelProps {
  sessionId?: string;
  draftProject?: DramaProject | null;
  run?: DramaRun | null;
  runGraph?: DramaRunGraph | null;
  planning?: boolean;
  shotTimelineOnCanvas?: boolean;
  productionTimelineOnCanvas?: boolean;
  finalVideoOnCanvas?: boolean;
  storyboardView?: "timeline" | "grid";
  onPublishToInspiration?: () => Promise<string | null | undefined>;
  onUnpublishFromInspiration?: (inspirationId: string) => Promise<void>;
  publishedInspirationId?: string | null;
  onStoryboardViewChange?: (view: "timeline" | "grid") => void;
  onConfirmProduce?: () => void;
  onRerunFromAgent?: (fromAgent: string) => void;
  rerunBusy?: boolean;
  onRetryShot?: (shotId: string, stage: "keyframe" | "video") => void;
  onPickKeyframe?: (shotId: string, heroIndex: number) => void;
  onSaveDraft?: (project: DramaProjectPayload) => Promise<unknown>;
  onRetryProduction?: (fromStep?: string) => void;
  onRerunFromNode?: (
    nodeId: string,
    projectPatch: DramaNodeRerunPatch,
  ) => void;
  rerunNodeBusy?: boolean;
  produceHint?: string | null;
  retryBusy?: boolean;
  busy?: boolean;
  readOnly?: boolean;
}

/** Dreamina / RHTV 式三栏 Studio：剧本资产 | 分镜板 | 制作进度 */
export function DramaStudioPanel({
  sessionId,
  draftProject,
  run,
  runGraph = null,
  planning,
  shotTimelineOnCanvas,
  productionTimelineOnCanvas,
  finalVideoOnCanvas,
  storyboardView = "grid",
  onPublishToInspiration,
  onUnpublishFromInspiration,
  publishedInspirationId,
  onStoryboardViewChange,
  onConfirmProduce,
  onRerunFromAgent,
  rerunBusy,
  onRetryShot,
  onPickKeyframe,
  onSaveDraft,
  onRetryProduction,
  onRerunFromNode,
  rerunNodeBusy,
  produceHint,
  retryBusy,
  busy,
  readOnly,
}: DramaStudioPanelProps) {
  const { user } = useAuth();
  const isDraft = Boolean(draftProject && !run);
  const [localProject, setLocalProject] = useState<DramaProjectPayload | null>(
    null,
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [liveEstimate, setLiveEstimate] = useState<number | null>(null);
  const [uploadingRef, setUploadingRef] = useState<string | null>(null);
  const [publishingInspiration, setPublishingInspiration] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewMembers, setReviewMembers] = useState<
    Array<{ id: string; email: string }>
  >([]);
  const charFileRef = useRef<HTMLInputElement>(null);
  const sceneFileRef = useRef<HTMLInputElement>(null);
  const pendingCharId = useRef<string | null>(null);
  const pendingSceneId = useRef<string | null>(null);

  const reviewWorkspaceId = getActiveWorkspaceId();
  const reviewProjectId = draftProject?.id ?? run?.projectId ?? null;

  useEffect(() => {
    if (!reviewOpen || !reviewWorkspaceId) return;
    let cancelled = false;
    fetchWorkspaceMembers(reviewWorkspaceId)
      .then((members) => {
        if (!cancelled) {
          setReviewMembers(
            members.map((m) => ({ id: m.id, email: m.email })),
          );
        }
      })
      .catch(() => {
        // ignore — 个人空间无成员
      });
    return () => {
      cancelled = true;
    };
  }, [reviewOpen, reviewWorkspaceId]);

  const baseProject = run?.project ?? draftProject?.project;
  const project = localProject ?? baseProject;

  const patchProject = useCallback(
    (patch: Partial<DramaProjectPayload>) => {
      if (!project) return;
      setLocalProject({ ...project, ...patch });
      setDirty(true);
    },
    [project],
  );

  const handleShotsChange = useCallback(
    (shots: DramaProjectPayload["shots"]) => {
      patchProject({ shots });
    },
    [patchProject],
  );

  const handleSave = useCallback(async () => {
    if (!localProject || !onSaveDraft) return;
    setSaving(true);
    try {
      await onSaveDraft(localProject);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [localProject, onSaveDraft]);

  const handleRefUpload = useCallback(
    async (file: File, kind: "character" | "scene", id: string) => {
      if (!sessionId || !project) return;
      setUploadingRef(`${kind}:${id}`);
      try {
        const asset = await uploadAsset(file, sessionId);
        if (kind === "character") {
          patchProject({
            characters: project.characters.map((c) =>
              c.id === id ? { ...c, refUrl: asset.url } : c,
            ),
          });
        } else {
          patchProject({
            scenes: project.scenes.map((s) =>
              s.id === id ? { ...s, refUrl: asset.url } : s,
            ),
          });
        }
      } finally {
        setUploadingRef(null);
      }
    },
    [sessionId, project, patchProject],
  );

  const handleCharacterProjectUpdate = useCallback(
    (updated: DramaProjectPayload) => {
      setLocalProject(updated);
    },
    [],
  );

  const handleLockCharacter = useCallback(
    async (characterId: string, status: "draft" | "locked") => {
      if (!project) return;
      const next: DramaProjectPayload = {
        ...project,
        characters: project.characters.map((c) =>
          c.id === characterId ? { ...c, turnaroundStatus: status } : c,
        ),
      };
      setLocalProject(next);
      if (onSaveDraft) {
        await onSaveDraft(next);
        setDirty(false);
      } else {
        setDirty(true);
      }
    },
    [project, onSaveDraft],
  );

  useEffect(() => {
    if (!isDraft || !project) {
      setLiveEstimate(null);
      return;
    }
    const timer = window.setTimeout(() => {
      void estimateDramaProjectPoints(project)
        .then(setLiveEstimate)
        .catch(() => setLiveEstimate(null));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [isDraft, project]);

  if (planning) {
    return (
      <div
        className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-4 text-center"
        data-testid="drama-studio-panel"
      >
        <p className="text-sm text-violet-200">规划进行中…</p>
        <p className="mt-1 text-xs text-zinc-500">
          五 Agent 正在协作编剧、分镜，请查看时间线进度
        </p>
      </div>
    );
  }

  if (!project) return null;

  const pipeline = run?.pipelineSteps ?? [];
  const previewTier = project.productionParams?.previewTier ?? "full";
  const confirmThreshold =
    run?.confirmIfPointsOver ?? DRAMA_CONFIRM_POINTS_THRESHOLD;
  const gatePoints = isDraft ? liveEstimate : run?.estimatedPoints;
  const insufficientCredits =
    user != null &&
    gatePoints != null &&
    user.credits < gatePoints;
  const needsHighCostConfirm = isDraft
    ? (liveEstimate ?? 0) >= confirmThreshold
    : run?.status === "waiting_confirm";
  const charactersLocked = allCharactersLockedForProduce(project.characters);

  const isProducing =
    run != null &&
    !["completed", "failed", "cancelled", "waiting_confirm"].includes(
      run.status,
    );
  const isFailed = run?.status === "failed";
  const activeStep =
    (run ? activePipelineStep(run) : undefined) ??
    pipeline.find((s) => s.current) ??
    (isFailed && run
      ? pipeline.find((s) => s.index === run.currentStepIndex)
      : undefined);
  const productionPercent = run ? computeProductionPercent(run) : 0;
  const productionCurrentLabel = run ? currentProductionLabel(run) : null;

  return (
    <div
      className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-3"
      data-testid="drama-studio-panel"
    >
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/5 pb-2">
        <h3 className="text-sm font-medium text-violet-200">AI 短剧 Studio</h3>
        <div className="flex items-center gap-2">
          {reviewWorkspaceId && reviewProjectId ? (
            <button
              type="button"
              onClick={() => setReviewOpen(true)}
              className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-zinc-300 transition hover:bg-white/10"
              title="审片评论"
            >
              <MessageSquare className="size-3" />
              审片
            </button>
          ) : null}
          {run ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] ${
                isFailed
                  ? "bg-red-500/15 text-red-300"
                  : isProducing
                    ? "bg-violet-500/20 text-violet-200"
                    : "bg-white/5 text-zinc-400"
              }`}
              data-testid="drama-run-status-badge"
            >
              {DRAMA_RUN_STATUS_LABEL[run.status] ?? run.status}
            </span>
          ) : liveEstimate != null ? (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
              预估 {liveEstimate} 分
            </span>
          ) : null}
        </div>
      </div>

      {reviewOpen && reviewWorkspaceId && reviewProjectId ? (
        <div
          className="fixed right-0 top-0 z-40 h-full w-80 border-l border-white/10 bg-zinc-950/95 shadow-2xl"
          data-testid="drama-review-sidebar"
        >
          <StudioReviewSidebar
            workspaceId={reviewWorkspaceId}
            projectId={reviewProjectId}
            runId={run?.id ?? null}
            members={reviewMembers}
            onClose={() => setReviewOpen(false)}
          />
        </div>
      ) : null}

      {produceHint ? (
        <div
          className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90"
          data-testid="drama-produce-hint"
        >
          {produceHint}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.9fr)]">
        {/* 左栏：剧本 / 角色 / 场景 */}
        <div className="space-y-3 overflow-y-auto max-h-[70vh] pr-1">
          <section>
            {isDraft && !readOnly ? (
              <>
                <input
                  className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-sm font-medium text-zinc-100"
                  value={project.script.title}
                  onChange={(e) =>
                    patchProject({
                      script: { ...project.script, title: e.target.value },
                    })
                  }
                  placeholder="短剧标题"
                />
                <textarea
                  className="mt-2 w-full resize-none rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-zinc-400"
                  rows={2}
                  value={project.script.logline}
                  onChange={(e) =>
                    patchProject({
                      script: { ...project.script, logline: e.target.value },
                    })
                  }
                  placeholder="一句话梗概"
                />
              </>
            ) : (
              <>
                <div className="text-sm font-medium text-zinc-100">
                  {project.script.title || "AI 短剧"}
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  {project.script.logline}
                </p>
              </>
            )}
          </section>

          {isDraft && !readOnly && project.script.acts.length > 0 ? (
            <section>
              <h4 className="mb-2 text-xs font-medium text-zinc-300">
                场次大纲
              </h4>
              <div className="space-y-2">
                {project.script.acts.map((act, i) => (
                  <div
                    key={`${act.act}-${act.sceneId}`}
                    className="rounded border border-white/10 bg-black/20 p-2 text-xs"
                  >
                    <div className="mb-1 text-[10px] text-zinc-500">
                      第 {act.act} 幕
                    </div>
                    <textarea
                      className="w-full resize-none rounded border border-white/10 bg-black/30 p-1 text-zinc-300"
                      rows={2}
                      value={act.summary}
                      onChange={(e) => {
                        const acts = [...project.script.acts];
                        acts[i] = { ...act, summary: e.target.value };
                        patchProject({ script: { ...project.script, acts } });
                      }}
                    />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section data-testid="drama-characters-section">
            <h4 className="mb-2 text-xs font-medium text-zinc-300">
              角色资产（{project.characters.length}）
            </h4>
            <div className="space-y-2">
              {project.characters.map((c) => (
                <DramaCharacterCardView
                  key={c.id}
                  character={c}
                  projectId={draftProject?.id ?? ""}
                  readOnly={!isDraft || readOnly || !draftProject?.id}
                  busy={busy || saving}
                  onProjectUpdate={handleCharacterProjectUpdate}
                  onLockCharacter={
                    isDraft && !readOnly && onSaveDraft
                      ? handleLockCharacter
                      : undefined
                  }
                  onUploadRef={
                    isDraft && !readOnly && sessionId
                      ? () => {
                          pendingCharId.current = c.id;
                          charFileRef.current?.click();
                        }
                      : undefined
                  }
                  uploadingRef={uploadingRef === `character:${c.id}`}
                />
              ))}
            </div>
          </section>

          <section>
            <h4 className="mb-2 text-xs font-medium text-zinc-300">场景</h4>
            <div className="space-y-2">
              {project.scenes.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs"
                >
                  <div className="flex items-start gap-2">
                    {s.refUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.refUrl}
                        alt=""
                        className="size-12 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="flex size-12 shrink-0 items-center justify-center rounded bg-white/5 text-[10px] text-zinc-600">
                        无图
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-zinc-200">{s.name}</div>
                      <div className="mt-0.5 line-clamp-2 text-zinc-500">
                        {s.promptAnchor}
                      </div>
                    </div>
                  </div>
                  {isDraft && !readOnly && sessionId ? (
                    <button
                      type="button"
                      disabled={busy || uploadingRef === `scene:${s.id}`}
                      className="mt-2 text-[10px] text-violet-300 hover:text-violet-200 disabled:opacity-50"
                      onClick={() => {
                        pendingSceneId.current = s.id;
                        sceneFileRef.current?.click();
                      }}
                    >
                      {uploadingRef === `scene:${s.id}`
                        ? "上传中…"
                        : s.refUrl
                          ? "替换参考图"
                          : "上传参考图"}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* 中栏：分镜板 */}
        <div className="min-w-0 border-x border-white/5 px-0 lg:px-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-medium text-zinc-300">
                分镜板（{project.shots.length} 镜）
              </h4>
              {shotTimelineOnCanvas && onStoryboardViewChange ? (
                <div
                  className="flex rounded border border-white/10 p-0.5 text-[10px]"
                  data-testid="drama-storyboard-view-toggle"
                >
                  <button
                    type="button"
                    className={`rounded px-1.5 py-0.5 ${
                      storyboardView === "timeline"
                        ? "bg-violet-500/20 text-violet-200"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                    onClick={() => onStoryboardViewChange("timeline")}
                  >
                    时间线
                  </button>
                  <button
                    type="button"
                    className={`rounded px-1.5 py-0.5 ${
                      storyboardView === "grid"
                        ? "bg-violet-500/20 text-violet-200"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                    onClick={() => onStoryboardViewChange("grid")}
                  >
                    网格
                  </button>
                </div>
              ) : null}
            </div>
            {isDraft && dirty && onSaveDraft ? (
              <button
                type="button"
                disabled={saving || busy}
                onClick={() => void handleSave()}
                className="rounded border border-violet-500/40 px-2 py-0.5 text-[10px] text-violet-300 hover:bg-violet-500/10 disabled:opacity-50"
              >
                {saving ? "保存中…" : "保存剧本"}
              </button>
            ) : null}
          </div>
          {shotTimelineOnCanvas && storyboardView === "timeline" ? (
            <p
              className="rounded-lg border border-white/5 bg-black/20 px-3 py-6 text-center text-xs text-zinc-500"
              data-testid="drama-storyboard-timeline-hint"
            >
              镜头轨已在主画布展示，可拖拽排序与编辑详情；切换「网格」查看九宫格视图。
            </p>
          ) : (
            <DramaStoryboardGrid
              shots={project.shots}
              onRetryShot={onRetryShot}
              onPickKeyframe={onPickKeyframe}
              readOnly={readOnly}
              editable={isDraft && !readOnly}
              onShotsChange={handleShotsChange}
            />
          )}
        </div>

        {/* 右栏：设置 / 进度 / 操作 */}
        <div className="space-y-3 overflow-y-auto max-h-[70vh]">
          {isDraft && !readOnly ? (
            <section className="space-y-2 text-xs">
              <span className="text-zinc-400">制作档位</span>
              <label className="flex items-center gap-1 text-zinc-300">
                <input
                  type="radio"
                  name="previewTier"
                  checked={previewTier === "full"}
                  onChange={() =>
                    patchProject({
                      productionParams: {
                        ...project.productionParams,
                        aspectRatio: project.styleBible.aspectRatio,
                        previewTier: "full",
                      },
                    })
                  }
                />
                高清成片（含口型）
              </label>
              <label className="flex items-center gap-1 text-zinc-300">
                <input
                  type="radio"
                  name="previewTier"
                  checked={previewTier === "low"}
                  onChange={() =>
                    patchProject({
                      productionParams: {
                        ...project.productionParams,
                        aspectRatio: project.styleBible.aspectRatio,
                        previewTier: "low",
                      },
                    })
                  }
                />
                低清预览（跳过口型）
              </label>
              <label className="flex items-center gap-1 text-zinc-300">
                <input
                  type="checkbox"
                  checked={project.productionParams?.autoQcRetry ?? false}
                  onChange={(e) =>
                    patchProject({
                      productionParams: {
                        ...project.productionParams,
                        aspectRatio: project.styleBible.aspectRatio,
                        autoQcRetry: e.target.checked,
                        qcRetryThreshold:
                          project.productionParams?.qcRetryThreshold ?? 70,
                      },
                    })
                  }
                />
                质检低分自动重拍关键帧（{"<"}70 分）
              </label>
            </section>
          ) : null}

          {pipeline.length > 0 ? (
            <section data-testid="drama-production-panel-progress">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-xs font-medium text-zinc-300">制作进度</h4>
                {run ? (
                  <span className="text-[10px] text-violet-300">
                    {productionPercent}%
                  </span>
                ) : null}
              </div>
              {run ? (
                <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-black/40">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isFailed
                        ? "bg-red-500/70"
                        : run.status === "completed"
                          ? "bg-emerald-500/80"
                          : "bg-violet-500/80"
                    }`}
                    style={{ width: `${productionPercent}%` }}
                  />
                </div>
              ) : null}
              {productionCurrentLabel ? (
                <p className="mb-2 text-[10px] text-violet-300/90">
                  {productionCurrentLabel}
                </p>
              ) : null}
              {isProducing && activeStep ? (
                <p className="mb-2 text-[10px] text-violet-300/90">
                  当前步骤：{activeStep.label}
                  {run?.status === "waiting_job" ? " · 等待任务完成" : ""}
                </p>
              ) : null}
              {isProducing && run?.pendingJobId ? (
                <p
                  className="mb-2 font-mono text-[10px] text-zinc-500"
                  data-testid="drama-pending-job"
                >
                  任务 {run.pendingJobId.slice(0, 8)}…
                </p>
              ) : null}
              {productionTimelineOnCanvas ? (
                <p
                  className="mb-2 text-[10px] text-zinc-500"
                  data-testid="drama-production-timeline-hint"
                >
                  镜头制作轨已在主画布展示，可查看每镜状态与重试。
                </p>
              ) : null}
              <ol className="space-y-1">
                {pipeline.map((step) => (
                  <li
                    key={step.id}
                    className={`flex items-center gap-2 text-xs ${
                      step.current
                        ? "text-violet-300"
                        : step.done
                          ? "text-emerald-400/80"
                          : "text-zinc-500"
                    }`}
                    data-testid={
                      step.current ? "drama-pipeline-step-current" : undefined
                    }
                  >
                    <span>{step.done ? "✓" : step.current ? "→" : "○"}</span>
                    <span>{step.label}</span>
                  </li>
                ))}
              </ol>
              {runGraph ? (
                <div className="mt-3 border-t border-white/5 pt-3">
                  <DramaNodeGraph
                    graph={runGraph}
                    shots={project?.shots}
                    interactive={
                      !readOnly &&
                      Boolean(onRerunFromNode) &&
                      (run?.status === "completed" ||
                        run?.status === "failed" ||
                        run?.status === "cancelled")
                    }
                    rerunBusy={rerunNodeBusy}
                    onRerunFromNode={onRerunFromNode}
                  />
                </div>
              ) : null}
            </section>
          ) : null}

          {isFailed && run?.error ? (
            <section
              className="rounded-lg border border-red-500/30 bg-red-500/10 p-3"
              data-testid="drama-produce-error"
            >
              <h4 className="mb-1 text-xs font-medium text-red-300">制作失败</h4>
              <p className="text-[11px] leading-relaxed text-red-200/80">
                {run.error}
              </p>
              {onRetryProduction ? (
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={busy || retryBusy}
                    onClick={() => onRetryProduction()}
                    className="w-full rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                    data-testid="drama-retry-production"
                  >
                    {retryBusy ? "重试中…" : "重试制作"}
                  </button>
                  {activeStep ? (
                    <button
                      type="button"
                      disabled={busy || retryBusy}
                      onClick={() => onRetryProduction(activeStep.id)}
                      className="w-full rounded border border-violet-500/40 px-3 py-1.5 text-xs text-violet-300 hover:bg-violet-500/10 disabled:opacity-50"
                      data-testid="drama-retry-from-step"
                    >
                      从「{activeStep.label}」重试
                    </button>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {run?.status === "completed" && run.finalVideoUrl ? (
            <section data-testid="drama-final-video-section">
              <h4 className="mb-2 text-xs font-medium text-zinc-300">成片</h4>
              {finalVideoOnCanvas ? (
                <p
                  className="mb-2 text-[10px] leading-relaxed text-zinc-500"
                  data-testid="drama-final-video-hint"
                >
                  成片播放器已在主画布展示，可预览、下载与发布灵感。
                </p>
              ) : (
                <a
                  href={run.finalVideoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-sky-400 underline"
                >
                  查看最终视频
                </a>
              )}
              {publishedInspirationId ? (
                <p
                  className="mt-2 text-[10px] text-emerald-300"
                  data-testid="drama-inspiration-published-panel"
                >
                  已发布灵感 ·{" "}
                  <a href="/inspiration" className="underline">
                    查看画廊
                  </a>
                </p>
              ) : onPublishToInspiration && !finalVideoOnCanvas ? (
                <button
                  type="button"
                  disabled={busy || publishingInspiration}
                  onClick={() => {
                    setPublishingInspiration(true);
                    void onPublishToInspiration().finally(() =>
                      setPublishingInspiration(false),
                    );
                  }}
                  className="mt-2 w-full rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                  data-testid="drama-publish-inspiration-panel"
                >
                  {publishingInspiration ? "发布中…" : "发布到灵感"}
                </button>
              ) : null}
              {publishedInspirationId && onUnpublishFromInspiration && !finalVideoOnCanvas ? (
                <button
                  type="button"
                  disabled={busy || publishingInspiration}
                  onClick={() => {
                    setPublishingInspiration(true);
                    void onUnpublishFromInspiration(publishedInspirationId).finally(
                      () => setPublishingInspiration(false),
                    );
                  }}
                  className="mt-2 w-full rounded border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/5 disabled:opacity-50"
                  data-testid="drama-unpublish-inspiration-panel"
                >
                  撤回发布
                </button>
              ) : null}
            </section>
          ) : null}

          {isDraft && onConfirmProduce ? (
            <>
              {!charactersLocked ? (
                <p
                  className="text-[11px] text-amber-400/90"
                  data-testid="drama-characters-lock-hint"
                >
                  请为所有角色生成三视图并确认定稿后再开始制作
                </p>
              ) : null}
              <button
                type="button"
                disabled={
                  busy || saving || insufficientCredits || !charactersLocked
                }
                onClick={onConfirmProduce}
                className={`w-full rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                  needsHighCostConfirm
                    ? "bg-amber-600 hover:bg-amber-500"
                    : "bg-violet-600 hover:bg-violet-500"
                }`}
                data-testid="drama-confirm-produce"
              >
                {needsHighCostConfirm
                  ? `确认积分预估（${liveEstimate ?? "…"} 分）并开始制作`
                  : "确认分镜，开始制作"}
                {!needsHighCostConfirm && previewTier === "low"
                  ? "（低清预览）"
                  : ""}
                {!needsHighCostConfirm && liveEstimate != null
                  ? ` · 约 ${liveEstimate} 分`
                  : ""}
              </button>
              {insufficientCredits && gatePoints != null ? (
                <p
                  className="text-[11px] text-amber-400/90"
                  data-testid="drama-insufficient-credits"
                >
                  积分不足：本次约需 {gatePoints} 分，当前余额 {user!.credits}{" "}
                  分，请充值后再制作
                </p>
              ) : null}
            </>
          ) : null}

          {isDraft && onRerunFromAgent && !readOnly ? (
            <section className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-2">
              <h4 className="mb-1.5 text-xs font-medium text-violet-200">
                修改后重跑
              </h4>
              <p className="mb-2 text-[10px] leading-relaxed text-zinc-500">
                保存剧本后，可从分镜 Agent 起重跑下游，保留上游 id
              </p>
              <button
                type="button"
                disabled={busy || saving || rerunBusy || dirty}
                onClick={async () => {
                  if (dirty && onSaveDraft && localProject) {
                    await onSaveDraft(localProject);
                    setDirty(false);
                  }
                  onRerunFromAgent("storyboard");
                }}
                className="w-full rounded border border-violet-500/40 px-3 py-1.5 text-xs text-violet-300 hover:bg-violet-500/10 disabled:opacity-50"
                data-testid="drama-rerun-from-storyboard"
              >
                {rerunBusy ? "重跑中…" : "从分镜 Agent 重跑"}
              </button>
              {dirty ? (
                <p className="mt-1 text-[10px] text-amber-400/80">
                  将先保存当前编辑再重跑
                </p>
              ) : null}
            </section>
          ) : null}

          {run?.status === "waiting_confirm" && onConfirmProduce ? (
            <>
              <button
                type="button"
                disabled={busy || insufficientCredits}
                onClick={onConfirmProduce}
                className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
              >
                确认积分预估（{run.estimatedPoints} 分）并开始制作
              </button>
              {insufficientCredits ? (
                <p
                  className="text-[11px] text-amber-400/90"
                  data-testid="drama-insufficient-credits"
                >
                  积分不足：本次约需 {run.estimatedPoints} 分，当前余额{" "}
                  {user!.credits} 分，请充值后再制作
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <input
        ref={charFileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const id = pendingCharId.current;
          if (file && id) void handleRefUpload(file, "character", id);
          e.target.value = "";
        }}
      />
      <input
        ref={sceneFileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const id = pendingSceneId.current;
          if (file && id) void handleRefUpload(file, "scene", id);
          e.target.value = "";
        }}
      />
    </div>
  );
}
