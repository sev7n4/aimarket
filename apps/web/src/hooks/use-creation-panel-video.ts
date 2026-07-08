"use client";

import type { CreationMode } from "@aimarket/ui";
import { useCallback, useMemo, useState } from "react";

import type { AspectRatio } from "@/components/generation-settings-popover";
import {
  routePickToVideoSlots,
  type VideoPickCandidate,
} from "@/lib/canvas-video-reference-bind";
import type {
  SmartMultiShot,
  VideoDurationSec,
  VideoMediaRef,
  VideoReferenceMode,
  VideoResolution,
} from "@/lib/creation-dock-prefs";
import { assignOmniRefLabels } from "@/lib/video-mention";
import { assetUrl } from "@/lib/api/core";
import { uploadAsset } from "@/lib/api/assets";
import { ensureSession } from "@/lib/api/sessions";
import { getVideoModelRoute } from "@/lib/api/generation";
import { applyModeVideoSettings } from "@/components/video-output-settings";
import { extractMentionLabelsFromPrompt } from "@/lib/mention-sync";
import type { ImageModel, VideoModelRouteMeta } from "@/lib/types";
import {
  resolveVideoSubmitModelId,
  type VideoAutoMeta,
} from "@/lib/video-auto-model";

export type UseCreationPanelVideoInput = {
  sessionId?: string;
  mode: CreationMode;
  user: { id: string } | null;
  onAuthRequired?: (hint?: string) => void;
  aspectRatio: AspectRatio;
  videoResolution: VideoResolution;
  videoDurationSec: VideoDurationSec;
  videoReferenceMode: VideoReferenceMode;
  setVideoReferenceMode: (mode: VideoReferenceMode) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  setVideoResolution: (res: VideoResolution) => void;
  setVideoDurationSec: (sec: VideoDurationSec) => void;
  modelId: string;
  models: ImageModel[];
  videoRoutes: VideoModelRouteMeta[];
  videoAutoMeta: VideoAutoMeta | null;
  prompt: string;
  setPrompt: (p: string | ((prev: string) => string)) => void;
};

export function useCreationPanelVideo(input: UseCreationPanelVideoInput) {
  const {
    sessionId,
    mode,
    user,
    onAuthRequired,
    aspectRatio,
    videoResolution,
    videoDurationSec,
    videoReferenceMode,
    setVideoReferenceMode,
    setAspectRatio,
    setVideoResolution,
    setVideoDurationSec,
    modelId,
    models,
    videoRoutes,
    videoAutoMeta,
    prompt,
    setPrompt,
  } = input;

  const [videoReferences, setVideoReferencesState] = useState<VideoMediaRef[]>([]);
  const setVideoReferences = useCallback((refs: VideoMediaRef[]) => {
    setVideoReferencesState(assignOmniRefLabels(refs));
  }, []);
  const [videoUploading, setVideoUploading] = useState(false);
  const [smartMultiShots, setSmartMultiShots] = useState<SmartMultiShot[]>([
    { order: 0, motionPrompt: "" },
    { order: 1, motionPrompt: "" },
  ]);
  const [firstLastMotionPrompt, setFirstLastMotionPrompt] = useState("");

  const handleVideoReferenceModeChange = useCallback(
    (nextMode: VideoReferenceMode) => {
      const coerced = applyModeVideoSettings(
        nextMode,
        {
          aspectRatio,
          videoResolution,
          videoDurationSec,
        },
        smartMultiShots.length,
      );
      setVideoReferenceMode(nextMode);
      setAspectRatio(coerced.aspectRatio as AspectRatio);
      setVideoResolution(coerced.videoResolution);
      setVideoDurationSec(coerced.videoDurationSec);
    },
    [
      aspectRatio,
      videoResolution,
      videoDurationSec,
      smartMultiShots.length,
      setVideoReferenceMode,
      setAspectRatio,
      setVideoResolution,
      setVideoDurationSec,
    ],
  );

  const uploadVideoReference = useCallback(
    async (file: File, _role?: VideoMediaRef["role"]) => {
      if (!sessionId) throw new Error("会话未就绪");
      if (!user) {
        onAuthRequired?.("登录后即可上传参考素材");
        throw new Error("需要登录");
      }
      setVideoUploading(true);
      try {
        await ensureSession(sessionId, mode);
        const data = await uploadAsset(file, sessionId, { lane: "video" });
        const previewUrl =
          data.url.startsWith("http") || data.url.startsWith("blob:")
            ? data.url
            : assetUrl(data.thumbUrl ?? data.url);
        return { assetId: data.id, url: previewUrl, mimeType: data.mimeType };
      } finally {
        setVideoUploading(false);
      }
    },
    [sessionId, mode, user, onAuthRequired],
  );

  const videoSubmitAspectRatio = useCallback((): string => {
    if (aspectRatio === "auto") return "16:9";
    return aspectRatio;
  }, [aspectRatio]);

  const capabilityDegradationMessage = useCallback(
    (targetModelId: string): string | undefined => {
      const route =
        getVideoModelRoute(targetModelId) ??
        videoRoutes.find((r) => r.modelId === targetModelId);
      if (!route?.capabilities) return undefined;
      const c = route.capabilities;
      if (videoReferenceMode === "omni" && c.omni === "image-only") {
        return "当前模型在全能参考模式下将降级为仅使用首张图片";
      }
      if (videoReferenceMode === "first-last" && c.firstLast === "first-only") {
        return "当前模型在首尾帧模式下将降级为仅首帧";
      }
      if (
        videoReferenceMode === "smart-multi-frame" &&
        c.smartMultiFrame === "degraded"
      ) {
        return "当前模型在智能多帧模式下将合并 prompt 与首图";
      }
      return undefined;
    },
    [videoReferenceMode, videoRoutes],
  );

  const applyVideoPickCandidate = useCallback(
    (pick: VideoPickCandidate, activeShotIndex = 0) => {
      const routed = routePickToVideoSlots(
        pick,
        videoReferenceMode,
        videoReferences,
        smartMultiShots,
        activeShotIndex,
      );
      setVideoReferences(routed.videoReferences);
      setSmartMultiShots(routed.smartMultiShots);
      if (videoReferenceMode === "omni") {
        const label = pick.label ?? "图片1";
        if (!extractMentionLabelsFromPrompt(prompt).includes(label)) {
          setPrompt((prev) => `${prev.trim()} @${label}`.trim());
        }
      }
    },
    [
      videoReferenceMode,
      videoReferences,
      smartMultiShots,
      prompt,
      setVideoReferences,
      setPrompt,
    ],
  );

  const smartMultiDegraded = useMemo(
    () =>
      videoReferenceMode === "smart-multi-frame" &&
      Boolean(
        capabilityDegradationMessage(
          resolveVideoSubmitModelId(modelId, models, videoAutoMeta),
        ),
      ),
    [
      videoReferenceMode,
      capabilityDegradationMessage,
      modelId,
      models,
      videoAutoMeta,
    ],
  );

  return {
    videoReferences,
    setVideoReferences,
    videoUploading,
    smartMultiShots,
    setSmartMultiShots,
    firstLastMotionPrompt,
    setFirstLastMotionPrompt,
    handleVideoReferenceModeChange,
    uploadVideoReference,
    videoSubmitAspectRatio,
    capabilityDegradationMessage,
    applyVideoPickCandidate,
    smartMultiDegraded,
  };
}
