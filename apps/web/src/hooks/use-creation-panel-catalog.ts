"use client";

import { useEffect, useMemo, useState } from "react";

import type { CreationMode } from "@aimarket/ui";
import { AUTO_MODEL_ID } from "@/components/model-picker";
import {
  estimatePoints,
  fetchModels,
  getVideoAutoModelMeta,
  getVideoModelRoutesMeta,
  suggestModel,
} from "@/lib/api/generation";
import { fetchReferences } from "@/lib/api/generation";
import { fetchSession } from "@/lib/api/sessions";
import { getToken } from "@/lib/api/core";
import { hasReferenceImages, type ReferenceImageSources } from "@/lib/creation-lane-submit";
import type { ImageModel, SessionReference, VideoModelRouteMeta } from "@/lib/types";
import type { VideoAutoMeta } from "@/lib/video-auto-model";
import type { CanvasItem } from "@/lib/canvas-tools";
import type { CreationLane } from "@/lib/creation-dock-prefs";

/** 模型目录：须在 video hook 之前调用 */
export function useCreationPanelModels(user: { id: string } | null) {
  const [models, setModels] = useState<ImageModel[]>([]);
  const [videoAutoMeta, setVideoAutoMeta] = useState<VideoAutoMeta | null>(null);
  const [videoRoutes, setVideoRoutes] = useState<VideoModelRouteMeta[]>([]);

  useEffect(() => {
    if (!user) {
      setModels([]);
      return;
    }
    fetchModels()
      .then((m) => {
        setModels(m);
        setVideoAutoMeta(getVideoAutoModelMeta());
        setVideoRoutes(getVideoModelRoutesMeta());
      })
      .catch(() => {
        setModels([]);
        setVideoAutoMeta(null);
        setVideoRoutes([]);
      });
  }, [user]);

  return { models, videoAutoMeta, videoRoutes };
}

export type UseCreationPanelDataEffectsInput = {
  user: { id: string } | null;
  mode: CreationMode;
  effectiveMode: CreationMode;
  sessionId?: string;
  initialPrompt?: string;
  prompt: string;
  setPrompt: (p: string | ((prev: string) => string)) => void;
  modelId: string;
  count: number;
  resolution: string;
  setResolution: (resolution: string) => void;
  setCount: (count: number) => void;
  buildReferenceSources: () => ReferenceImageSources;
  canvasItems: CanvasItem[];
  assetIds: string[];
  mentionedAssetIds: string[];
  selectedRefs: unknown[];
  selectedCanvasItem?: CanvasItem | null;
  creationLane: CreationLane;
  focusEditPointCount: number;
};

/** 会话数据副作用：须在 assets hook 之后调用（依赖 buildReferenceSources） */
export function useCreationPanelDataEffects(input: UseCreationPanelDataEffectsInput) {
  const {
    user,
    mode,
    effectiveMode,
    sessionId,
    initialPrompt,
    prompt,
    setPrompt,
    modelId,
    count,
    resolution,
    setResolution,
    setCount,
    buildReferenceSources,
    canvasItems,
    assetIds,
    mentionedAssetIds,
    selectedRefs,
    selectedCanvasItem,
    creationLane,
    focusEditPointCount,
  } = input;

  const [estimated, setEstimated] = useState<number | null>(null);
  const [routeHint, setRouteHint] = useState<string | null>(null);
  const [references, setReferences] = useState<SessionReference[]>([]);

  useEffect(() => {
    if (initialPrompt) setPrompt(initialPrompt);
  }, [initialPrompt, setPrompt]);

  const canvasMentionSignature = useMemo(
    () =>
      canvasItems
        .map((i) => `${i.id}:${i.outputId ?? ""}:${i.assetId ?? ""}`)
        .join("|"),
    [canvasItems],
  );

  useEffect(() => {
    if (!user || !sessionId) return;
    let cancelled = false;
    void (async () => {
      try {
        const existing = await fetchSession(sessionId).catch(() => null);
        if (!existing || cancelled) return;
        const refs = await fetchReferences(sessionId);
        if (!cancelled) setReferences(refs);
      } catch {
        if (!cancelled) setReferences([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, sessionId, canvasMentionSignature, mode]);

  useEffect(() => {
    if (!user || !getToken()) {
      setEstimated(null);
      return;
    }
    const effectiveCount = count;
    const effectiveModel =
      modelId === AUTO_MODEL_ID
        ? "omni-v2"
        : modelId;
    const effectiveRes = resolution;
    estimatePoints(effectiveModel, effectiveCount, effectiveRes)
      .then(setEstimated)
      .catch(() => setEstimated(null));
  }, [user, modelId, count, resolution, mode, effectiveMode]);

  useEffect(() => {
    if (!user) return;
    const refsForSuggest = buildReferenceSources();
    const hasRefsForSuggest = hasReferenceImages(refsForSuggest);
    const t = setTimeout(() => {
      suggestModel(mode, prompt, hasRefsForSuggest)
        .then((s) => {
          if (modelId === AUTO_MODEL_ID) {
            setRouteHint(s.reason ? `Auto → ${s.reason}` : "Auto 路由");
          } else {
            setRouteHint(s.reason);
          }
        })
        .catch(() => setRouteHint(null));
    }, 400);
    return () => clearTimeout(t);
  }, [
    user,
    mode,
    prompt,
    modelId,
    assetIds.length,
    mentionedAssetIds.length,
    selectedRefs.length,
    selectedCanvasItem?.id,
    creationLane,
    focusEditPointCount,
    effectiveMode,
    buildReferenceSources,
  ]);

  return {
    estimated,
    routeHint,
    setRouteHint,
    references,
    setReferences,
  };
}
