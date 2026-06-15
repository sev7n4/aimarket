"use client";

import { useCallback, useState } from "react";
import { DramaStoryboardGrid } from "@/components/drama-storyboard-grid";
import type { DramaProject, DramaProjectPayload, DramaRun } from "@/lib/types";

interface DramaStudioPanelProps {
  draftProject?: DramaProject | null;
  run?: DramaRun | null;
  onConfirmProduce?: () => void;
  onRetryShot?: (shotId: string, stage: "keyframe" | "video") => void;
  onSaveDraft?: (project: DramaProjectPayload) => Promise<unknown>;
  busy?: boolean;
  readOnly?: boolean;
}

/** Dreamina / RHTV 式透明分步面板：剧本 → 角色 → 分镜 → 进度 */
export function DramaStudioPanel({
  draftProject,
  run,
  onConfirmProduce,
  onRetryShot,
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

  if (!project) return null;

  const pipeline = run?.pipelineSteps ?? [];
  const previewTier = project.productionParams?.previewTier ?? "full";

  return (
    <div className="space-y-4 rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
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
              <h3 className="text-sm font-medium text-zinc-100">
                {project.script.title || "AI 短剧"}
              </h3>
              <p className="mt-1 text-xs text-zinc-400">{project.script.logline}</p>
            </>
          )}
        </div>
        {run ? (
          <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
            {run.status}
          </span>
        ) : null}
      </div>

      {isDraft && !readOnly ? (
        <section className="flex items-center gap-3 text-xs">
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
            低清预览（跳过口型，省积分）
          </label>
        </section>
      ) : null}

      <section>
        <h4 className="mb-2 text-xs font-medium text-zinc-300">
          角色资产（Anchor First）
        </h4>
        <div className="flex flex-wrap gap-2">
          {project.characters.map((c) => (
            <div
              key={c.id}
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs"
            >
              <div className="font-medium text-zinc-200">{c.name}</div>
              <div className="mt-0.5 line-clamp-2 text-zinc-500">
                {c.promptAnchor}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
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
          readOnly={readOnly}
          editable={isDraft && !readOnly}
          onShotsChange={handleShotsChange}
        />
      </section>

      {pipeline.length > 0 ? (
        <section>
          <h4 className="mb-2 text-xs font-medium text-zinc-300">制作进度</h4>
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
        >
          确认分镜，开始制作
          {previewTier === "low" ? "（低清预览）" : ""}
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
  );
}
