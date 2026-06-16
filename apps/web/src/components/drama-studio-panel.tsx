"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DramaStoryboardGrid } from "@/components/drama-storyboard-grid";
import { estimateDramaProjectPoints, uploadAsset } from "@/lib/api-client";
import type { DramaProject, DramaProjectPayload, DramaRun } from "@/lib/types";

interface DramaStudioPanelProps {
  sessionId?: string;
  draftProject?: DramaProject | null;
  run?: DramaRun | null;
  onConfirmProduce?: () => void;
  onRetryShot?: (shotId: string, stage: "keyframe" | "video") => void;
  onPickKeyframe?: (shotId: string, heroIndex: number) => void;
  onSaveDraft?: (project: DramaProjectPayload) => Promise<unknown>;
  busy?: boolean;
  readOnly?: boolean;
}

/** Dreamina / RHTV 式三栏 Studio：剧本资产 | 分镜板 | 制作进度 */
export function DramaStudioPanel({
  sessionId,
  draftProject,
  run,
  onConfirmProduce,
  onRetryShot,
  onPickKeyframe,
  onSaveDraft,
  busy,
  readOnly,
}: DramaStudioPanelProps) {
  const isDraft = Boolean(draftProject && !run);
  const [localProject, setLocalProject] = useState<DramaProjectPayload | null>(
    null,
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [liveEstimate, setLiveEstimate] = useState<number | null>(null);
  const [uploadingRef, setUploadingRef] = useState<string | null>(null);
  const charFileRef = useRef<HTMLInputElement>(null);
  const sceneFileRef = useRef<HTMLInputElement>(null);
  const pendingCharId = useRef<string | null>(null);
  const pendingSceneId = useRef<string | null>(null);

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

  if (!project) return null;

  const pipeline = run?.pipelineSteps ?? [];
  const previewTier = project.productionParams?.previewTier ?? "full";

  return (
    <div
      className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-3"
      data-testid="drama-studio-panel"
    >
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/5 pb-2">
        <h3 className="text-sm font-medium text-violet-200">AI 短剧 Studio</h3>
        {run ? (
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
            {run.status}
          </span>
        ) : liveEstimate != null ? (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
            预估 {liveEstimate} 分
          </span>
        ) : null}
      </div>

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

          <section>
            <h4 className="mb-2 text-xs font-medium text-zinc-300">
              角色资产
            </h4>
            <div className="space-y-2">
              {project.characters.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs"
                >
                  <div className="flex items-start gap-2">
                    {c.refUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.refUrl}
                        alt=""
                        className="size-12 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="flex size-12 shrink-0 items-center justify-center rounded bg-white/5 text-[10px] text-zinc-600">
                        无图
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-zinc-200">{c.name}</div>
                      <div className="mt-0.5 line-clamp-2 text-zinc-500">
                        {c.promptAnchor}
                      </div>
                    </div>
                  </div>
                  {isDraft && !readOnly && sessionId ? (
                    <button
                      type="button"
                      disabled={busy || uploadingRef === `character:${c.id}`}
                      className="mt-2 text-[10px] text-violet-300 hover:text-violet-200 disabled:opacity-50"
                      onClick={() => {
                        pendingCharId.current = c.id;
                        charFileRef.current?.click();
                      }}
                    >
                      {uploadingRef === `character:${c.id}`
                        ? "上传中…"
                        : c.refUrl
                          ? "替换参考图"
                          : "上传参考图"}
                    </button>
                  ) : null}
                </div>
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
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-xs font-medium text-zinc-300">
              分镜板（{project.shots.length} 镜）
            </h4>
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
          <DramaStoryboardGrid
            shots={project.shots}
            onRetryShot={onRetryShot}
            onPickKeyframe={onPickKeyframe}
            readOnly={readOnly}
            editable={isDraft && !readOnly}
            onShotsChange={handleShotsChange}
          />
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
            </section>
          ) : null}

          {pipeline.length > 0 ? (
            <section>
              <h4 className="mb-2 text-xs font-medium text-zinc-300">
                制作进度
              </h4>
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
                  >
                    <span>{step.done ? "✓" : step.current ? "→" : "○"}</span>
                    <span>{step.label}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {run?.finalVideoUrl ? (
            <section>
              <h4 className="mb-2 text-xs font-medium text-zinc-300">成片</h4>
              <a
                href={run.finalVideoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-sky-400 underline"
              >
                查看最终视频
              </a>
            </section>
          ) : null}

          {isDraft && onConfirmProduce ? (
            <button
              type="button"
              disabled={busy || saving}
              onClick={onConfirmProduce}
              className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
              data-testid="drama-confirm-produce"
            >
              确认分镜，开始制作
              {previewTier === "low" ? "（低清预览）" : ""}
              {liveEstimate != null ? ` · 约 ${liveEstimate} 分` : ""}
            </button>
          ) : null}

          {run?.status === "waiting_confirm" && onConfirmProduce ? (
            <button
              type="button"
              disabled={busy}
              onClick={onConfirmProduce}
              className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
            >
              确认积分预估（{run.estimatedPoints} 分）并开始制作
            </button>
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
