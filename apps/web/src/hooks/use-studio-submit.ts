"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreationMode } from "@aimarket/ui";

import { useStudioOrchestrationOptional } from "@/components/studio-orchestration-provider";
import { useCreationLaneDrafts } from "@/hooks/use-creation-lane-drafts";
import {
  fetchModels,
  getVideoAutoModelMeta,
  getVideoModelRoutesMeta,
} from "@/lib/api/generation";
import { trackEvent } from "@/lib/api/studio";
import type { CanvasItem } from "@/lib/canvas-tools";
import type { PendingBatchLineage } from "@/lib/canvas-tools";
import type { ImageModel, VideoModelRouteMeta } from "@/lib/types";
import { runStudioSubmit } from "@/lib/studio-submit";
import type { VideoAutoMeta } from "@/lib/video-auto-model";

export type UseStudioSubmitOptions = {
  sessionId: string;
  mode: CreationMode;
  prompt: string;
  readOnly: boolean;
  user: unknown;
  canvasItems: CanvasItem[];
  onJobStarted: (jobId: string, lineage?: PendingBatchLineage) => void;
  onAuthRequired?: () => void;
  onPromptClear?: () => void;
  onInteractionHint?: (message: string) => void;
};

export function useStudioSubmit({
  sessionId,
  mode,
  prompt,
  readOnly,
  user,
  canvasItems,
  onJobStarted,
  onAuthRequired,
  onPromptClear,
  onInteractionHint,
}: UseStudioSubmitOptions) {
  const studioOrch = useStudioOrchestrationOptional();
  const { creationLane, laneSettings } = useCreationLaneDrafts("studio", {
    agentLaneAvailable: true,
  });
  const {
    modelId,
    aspectRatio,
    count,
    resolution,
    videoReferenceMode,
    videoDurationSec,
    videoResolution,
  } = laneSettings;

  const [models, setModels] = useState<ImageModel[]>([]);
  const [videoRoutes, setVideoRoutes] = useState<VideoModelRouteMeta[]>([]);
  const [videoAutoMeta, setVideoAutoMeta] = useState<VideoAutoMeta | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [modelList, routes] = await Promise.all([
          fetchModels(),
          Promise.resolve(getVideoModelRoutesMeta()),
        ]);
        const autoMeta = getVideoAutoModelMeta();
        if (!cancelled) {
          setModels(modelList);
          setVideoRoutes(routes);
          setVideoAutoMeta(autoMeta);
        }
      } catch {
        /* models optional for first paint */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = useCallback(async () => {
    if (readOnly || pending) return;
    if (!prompt.trim()) {
      onInteractionHint?.("请先输入描述，再点击开始生成");
      return;
    }
    if (!user) {
      onAuthRequired?.();
      return;
    }

    setPending(true);
    try {
      const result = await runStudioSubmit({
        readOnly,
        sessionId,
        mode,
        prompt,
        creationLane,
        activeSkillId: null,
        modelId,
        aspectRatio,
        count,
        resolution,
        videoReferenceMode,
        videoDurationSec,
        videoResolution,
        videoReferences: [],
        smartMultiShots: [
          { order: 0, motionPrompt: "" },
          { order: 1, motionPrompt: "" },
        ],
        firstLastMotionPrompt: "",
        canvasItems,
        referenceImageSources: {
          assetIds: [],
          mentionedAssetIds: [],
          selectedRefIds: [],
        },
        mentionedMasks: [],
        models,
        videoRoutes,
        videoAutoMeta,
        studioOrchestrationActive: studioOrch != null,
        studioOrch,
        agentRun: studioOrch?.agentRun,
        skillRun: studioOrch?.skillRun,
        confirmAgentRun: () => studioOrch?.confirmOrchestration() ?? Promise.resolve(),
        startAgentRun: (p) => studioOrch?.startAgentRun(p) ?? Promise.resolve(null),
        confirmSkillRun: () => studioOrch?.confirmOrchestration() ?? Promise.resolve(),
        startSkillRun: (skillId, payload) =>
          studioOrch?.startSkillRun(skillId, payload) ?? Promise.resolve(null),
        onAlert: (message) => alert(message),
      });

      if (result.status === "direct") {
        onPromptClear?.();
        void trackEvent("generation_submit", { mode, sessionId });
        onJobStarted(result.jobId, result.lineage);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "提交失败");
    } finally {
      setPending(false);
    }
  }, [
    readOnly,
    pending,
    prompt,
    user,
    sessionId,
    mode,
    creationLane,
    modelId,
    aspectRatio,
    count,
    resolution,
    videoReferenceMode,
    videoDurationSec,
    videoResolution,
    canvasItems,
    models,
    videoRoutes,
    videoAutoMeta,
    studioOrch,
    onJobStarted,
    onAuthRequired,
    onPromptClear,
    onInteractionHint,
  ]);

  return {
    submit,
    submitting: pending,
    canSubmit: Boolean(prompt.trim()) && !readOnly && !pending && Boolean(user),
  };
}
