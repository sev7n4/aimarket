"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import {
  DramaSceneCardShell,
  dramaSceneDisplayFromCard,
} from "@/components/drama/drama-scene-card-shell";
import { DramaAssetRegenPopover } from "@/components/drama/drama-asset-regen-popover";
import { fetchDramaProject, generateDramaSceneRef } from "@/lib/api/drama";
import type { DramaProjectPayload, DramaSceneCard } from "@/lib/types";

type DramaSceneCardViewProps = {
  scene: DramaSceneCard;
  projectId?: string;
  readOnly?: boolean;
  busy?: boolean;
  uploadingRef?: boolean;
  onProjectUpdate?: (project: DramaProjectPayload) => void;
  onUploadRef?: () => void;
  genError?: string | null;
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
  genError,
}: DramaSceneCardViewProps) {
  const [userGenerating, setUserGenerating] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoGenTriggered = useRef(false);

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
  const displayError = genError ?? localError;

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

  const handleGenerate = useCallback(
    async (options?: { force?: boolean; promptOverride?: string }) => {
      if (!interactive || !projectId || busy || generating) return;
      setUserGenerating(true);
      setLocalError(null);
      try {
        const data = await generateDramaSceneRef(projectId, scene.id, {
          force: options?.force ?? !refReady,
          promptOverride: options?.promptOverride,
        });
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
      } catch (err) {
        setUserGenerating(false);
        setLocalError(err instanceof Error ? err.message : "生成失败");
        stopPoll();
      }
    },
    [
      interactive,
      projectId,
      busy,
      generating,
      refReady,
      scene.id,
      onProjectUpdate,
      refreshProject,
      stopPoll,
    ],
  );

  useEffect(() => {
    if (
      autoGenTriggered.current ||
      !interactive ||
      refReady ||
      pending ||
      generating ||
      displayError
    ) {
      return;
    }
    autoGenTriggered.current = true;
    void handleGenerate();
  }, [
    interactive,
    refReady,
    pending,
    generating,
    displayError,
    handleGenerate,
  ]);

  return (
    <>
      <DramaSceneCardShell
        mode="panel"
        scene={dramaSceneDisplayFromCard(scene, {
          generating,
          error: displayError,
        })}
        testId={`drama-scene-card-${scene.id}`}
        className="rounded-lg border border-white/10 bg-black/20"
        footer={
          !readOnly ? (
            <div className="flex flex-wrap gap-2">
              {interactive ? (
                <>
                  <button
                    type="button"
                    disabled={busy || generating}
                    onClick={() => void handleGenerate({ force: refReady })}
                    className="text-[10px] text-cyan-300 hover:text-cyan-200 disabled:opacity-50"
                    data-testid="drama-scene-ref-generate"
                  >
                    {generating ? "生成中…" : refReady ? "重新生成" : "生成场景图"}
                  </button>
                  <button
                    type="button"
                    disabled={busy || generating}
                    onClick={() => setRegenOpen(true)}
                    className="inline-flex items-center gap-0.5 text-[10px] text-violet-300 hover:text-violet-200 disabled:opacity-50"
                    data-testid="drama-scene-ref-refine"
                  >
                    <Sparkles className="size-3" />
                    提示词改图
                  </button>
                </>
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
      />

      {interactive ? (
        <DramaAssetRegenPopover
          open={regenOpen}
          title={`迭代场景「${scene.name}」`}
          placeholder="例如：雨夜霓虹、玻璃反光、暖色吊灯…"
          busy={busy || generating}
          onClose={() => setRegenOpen(false)}
          onSubmit={async (instruction) => {
            await handleGenerate({ force: true, promptOverride: instruction });
          }}
        />
      ) : null}
    </>
  );
}
