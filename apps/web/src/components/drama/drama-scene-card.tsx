"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

import { DramaAssetCardShell } from "@/components/drama/drama-asset-card-shell";
import { DramaBadge } from "@/components/drama/drama-badge";
import { fetchDramaProject, generateDramaSceneRef } from "@/lib/api-client";
import type { DramaProjectPayload, DramaSceneCard } from "@/lib/types";

type DramaSceneCardViewProps = {
  scene: DramaSceneCard;
  projectId?: string;
  readOnly?: boolean;
  busy?: boolean;
  uploadingRef?: boolean;
  onProjectUpdate?: (project: DramaProjectPayload) => void;
  onUploadRef?: () => void;
};

/** Agent 面板：场景资产卡片 */
export function DramaSceneCardView({
  scene,
  projectId,
  readOnly,
  busy,
  uploadingRef,
  onProjectUpdate,
  onUploadRef,
}: DramaSceneCardViewProps) {
  const [userGenerating, setUserGenerating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refreshProject = useCallback(async () => {
    if (!projectId || !onProjectUpdate) return null;
    const next = await fetchDramaProject(projectId);
    onProjectUpdate(next.project);
    return next.project;
  }, [projectId, onProjectUpdate]);

  const refReady = Boolean(scene.refUrl);
  const pending = scene.refPending === true;
  const generating = pending || userGenerating;
  const interactive = Boolean(projectId && onProjectUpdate && !readOnly);

  useEffect(() => () => stopPoll(), [stopPoll]);

  useEffect(() => {
    if (!interactive || !projectId || refReady || !pending) return;
    const timer = setInterval(() => {
      void refreshProject().then((project) => {
        if (!project) return;
        const nextScene = project.scenes.find((s) => s.id === scene.id);
        if (nextScene?.refUrl) {
          setUserGenerating(false);
        }
      });
    }, 2000);
    return () => clearInterval(timer);
  }, [interactive, projectId, refReady, pending, refreshProject, scene.id]);

  const handleGenerate = useCallback(async () => {
    if (!interactive || !projectId || busy || generating) return;
    setUserGenerating(true);
    try {
      const data = await generateDramaSceneRef(projectId, scene.id);
      onProjectUpdate!(data.project.project);

      stopPoll();
      pollRef.current = setInterval(() => {
        void refreshProject().then((project) => {
          const nextScene = project?.scenes.find((s) => s.id === scene.id);
          if (nextScene?.refUrl) {
            stopPoll();
            setUserGenerating(false);
          }
        });
      }, 1500);
    } catch {
      setUserGenerating(false);
      stopPoll();
    }
  }, [
    interactive,
    projectId,
    busy,
    generating,
    scene.id,
    onProjectUpdate,
    refreshProject,
    stopPoll,
  ]);

  const hero = scene.refUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={scene.refUrl}
      alt={scene.name}
      className="size-full object-cover"
    />
  ) : (
    <div className="flex size-full flex-col items-center justify-center gap-1 text-zinc-600">
      <MapPin className="size-6 opacity-40" />
      <span className="text-[10px]">
        {generating ? "生成中…" : "待生成场景参考图"}
      </span>
    </div>
  );

  return (
    <DramaAssetCardShell
      category="scene"
      hero={hero}
      heroAspect="landscape"
      testId={`drama-scene-card-${scene.id}`}
      className="rounded-lg border border-white/10 bg-black/20"
      badges={
        <>
          {scene.atmosphere ? (
            <DramaBadge color="#06b6d4">{scene.atmosphere}</DramaBadge>
          ) : null}
          {scene.era ? (
            <span className="text-[10px] text-zinc-500">{scene.era}</span>
          ) : null}
        </>
      }
      footer={
        !readOnly ? (
          <div className="flex flex-wrap gap-2">
            {interactive ? (
              <button
                type="button"
                disabled={busy || generating || refReady}
                onClick={() => void handleGenerate()}
                className="text-[10px] text-cyan-300 hover:text-cyan-200 disabled:opacity-50"
                data-testid="drama-scene-ref-generate"
              >
                {generating ? "生成中…" : "生成场景图"}
              </button>
            ) : null}
            {onUploadRef ? (
              <button
                type="button"
                disabled={busy || generating || uploadingRef}
                onClick={onUploadRef}
                className="text-[10px] text-cyan-300 hover:text-cyan-200 disabled:opacity-50"
              >
                {uploadingRef
                  ? "上传中…"
                  : scene.refUrl
                    ? "替换参考图"
                    : "上传参考图"}
              </button>
            ) : null}
          </div>
        ) : null
      }
    >
      <div className="text-sm font-semibold leading-snug text-zinc-100">
        {scene.name}
      </div>
      {scene.location ? (
        <div className="flex items-center gap-1 text-xs text-zinc-400">
          <MapPin className="size-3 shrink-0 opacity-70" />
          <span className="truncate">{scene.location}</span>
        </div>
      ) : null}
      {scene.promptAnchor ? (
        <p className="line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
          {scene.promptAnchor}
        </p>
      ) : null}
    </DramaAssetCardShell>
  );
}
