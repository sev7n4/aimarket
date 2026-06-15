"use client";

import { DramaStoryboardGrid } from "@/components/drama-storyboard-grid";
import type { DramaProject, DramaRun } from "@/lib/types";

interface DramaStudioPanelProps {
  draftProject?: DramaProject | null;
  run?: DramaRun | null;
  onConfirmProduce?: () => void;
  onRetryShot?: (shotId: string, stage: "keyframe" | "video") => void;
  busy?: boolean;
  readOnly?: boolean;
}

/** Dreamina / RHTV 式透明分步面板：剧本 → 角色 → 分镜 → 进度 */
export function DramaStudioPanel({
  draftProject,
  run,
  onConfirmProduce,
  onRetryShot,
  busy,
  readOnly,
}: DramaStudioPanelProps) {
  const project = run?.project ?? draftProject?.project;
  if (!project) return null;

  const isDraft = Boolean(draftProject && !run);
  const pipeline = run?.pipelineSteps ?? [];

  return (
    <div className="space-y-4 rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-100">
            {project.script.title || "AI 短剧"}
          </h3>
          <p className="mt-1 text-xs text-zinc-400">{project.script.logline}</p>
        </div>
        {run ? (
          <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
            {run.status}
          </span>
        ) : null}
      </div>

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
        <h4 className="mb-2 text-xs font-medium text-zinc-300">
          分镜板（{project.shots.length} 镜）
        </h4>
        <DramaStoryboardGrid
          shots={project.shots}
          onRetryShot={onRetryShot}
          readOnly={readOnly}
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
                  step.current ? "text-violet-300" : step.done ? "text-emerald-400/80" : "text-zinc-500"
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
          disabled={busy}
          onClick={onConfirmProduce}
          className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          确认分镜，开始制作
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
