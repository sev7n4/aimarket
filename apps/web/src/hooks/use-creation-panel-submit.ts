"use client";

import type { CreationMode } from "@aimarket/ui";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";

import { AUTO_MODEL_ID } from "@/components/model-picker";
import type { CreationPanelHandle } from "@/components/creation-panel-types";
import { DRAMA_SKILL_ID } from "@/components/creation-dock-controls";
import type { StudioOrchestrationContextValue } from "@/components/studio-orchestration-provider";
import type { AspectRatio } from "@/components/generation-settings-popover";
import type { UploadPreviewItem } from "@/components/upload-preview-stack";
import type {
  CanvasItem,
  CanvasMaskSelection,
  PendingBatchLineage,
} from "@/lib/canvas-tools";
import type { CreationLane, SmartMultiShot, VideoDurationSec, VideoMediaRef, VideoReferenceMode, VideoResolution } from "@/lib/creation-dock-prefs";
import {
  hasReferenceImages,
  resolveCreationSubmitPathFromContext,
  type ReferenceImageSources,
} from "@/lib/creation-lane-submit";
import { dispatchCreationSubmit } from "@/lib/creation-submit-dispatch";
import { fetchReferences } from "@/lib/api/generation";
import { ensureSession } from "@/lib/api/sessions";
import { fetchProviderStatus, trackEvent } from "@/lib/api/studio";
import { clientNavigate } from "@/lib/client-navigate";
import { persistCreationLane } from "@/lib/creation-dock-prefs";
import { recordAcceptedPrompt } from "@/lib/prompt-style-profile";
import { runStudioSubmit } from "@/lib/studio-submit";
import type { ImageModel, SessionReference, AgentRun, SkillRun } from "@/lib/types";
import type { VideoAutoMeta } from "@/lib/video-auto-model";
import type { VideoModelRouteMeta } from "@/lib/types";
import { randomUUID } from "@/lib/uuid";
import { storePendingAssets } from "@/lib/pending-assets";
import type {
  FocusEditIntent,
  FocusPointChip,
} from "@/lib/focus-edit";

export type UseCreationPanelSubmitInput = {
  panelRef?: Ref<CreationPanelHandle>;
  readOnly: boolean;
  streamBusy: boolean;
  prompt: string;
  effectiveMode: CreationMode;
  selectedSkillId: string | null;
  polishCandidates: string[];
  onInteractionHint?: (hint: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  submitEcommerce: boolean;
  activeSkillId: string | null;
  buildReferenceSources: () => ReferenceImageSources;
  resolveProductAssetId: () => string | null;
  modelId: string;
  homeDirectSubmit: boolean;
  user: { id: string } | null;
  onAuthRequired?: (hint?: string) => void;
  creationLane: CreationLane;
  sessionId?: string;
  mode: CreationMode;
  router: AppRouterInstance;
  shouldNavigateOnSubmit: boolean;
  assetIds: string[];
  uploadPreviews: UploadPreviewItem[];
  focusEdit: {
    intent: FocusEditIntent;
    points: FocusPointChip[];
    recognizing?: boolean;
  } | null;
  onFocusEditSubmit?: (args: {
    prompt: string;
    intent: FocusEditIntent;
    points: FocusPointChip[];
    item: CanvasItem;
  }) => Promise<string>;
  canvasItems: CanvasItem[];
  setPrompt: (p: string | ((prev: string) => string)) => void;
  refreshUser: () => Promise<void>;
  onJobStarted?: (jobId: string, lineage?: PendingBatchLineage) => void;
  isStudioDock: boolean;
  aspectRatio: AspectRatio;
  count: number;
  resolution: string;
  videoReferenceMode: VideoReferenceMode;
  videoDurationSec: VideoDurationSec;
  videoResolution: VideoResolution;
  videoReferences: VideoMediaRef[];
  smartMultiShots: SmartMultiShot[];
  firstLastMotionPrompt: string;
  mentionedMasks: CanvasMaskSelection[];
  models: ImageModel[];
  videoRoutes: VideoModelRouteMeta[];
  videoAutoMeta: VideoAutoMeta | null;
  referenceAssetId: string | null;
  productAssetId: string | null;
  studioOrchestrationActive: boolean;
  studioOrch: StudioOrchestrationContextValue | null;
  orchAgentRun: AgentRun | null;
  orchSkillRun: SkillRun | null;
  confirmAgentRun: () => Promise<unknown>;
  startAgentRun: (prompt: string) => Promise<unknown>;
  confirmSkillRun: () => Promise<unknown>;
  startSkillRun: (
    skillId: string,
    payload: {
      prompt: string;
      productAssetId?: string;
      referenceAssetId?: string;
    },
  ) => Promise<unknown>;
  clearAttachmentState: () => void;
  setMentionedMasks: React.Dispatch<React.SetStateAction<CanvasMaskSelection[]>>;
  setDockSkillId: (id: string | null) => void;
  setReferences: React.Dispatch<React.SetStateAction<SessionReference[]>>;
  skillsEnabled: boolean;
  agentEnabled: boolean;
  isDock: boolean;
  submitVideo: boolean;
  dramaOrchestrationActive: boolean;
  setRouteHint: (hint: string | null) => void;
  setProductAssetId: (id: string | null) => void;
  setReferenceAssetId: (id: string | null) => void;
  brand: string;
  platform: string;
  market: string;
  language: string;
  designer: string;
  autoSubmitOnce: boolean;
};

export function useCreationPanelSubmit(input: UseCreationPanelSubmitInput) {
  const {
    panelRef,
    readOnly,
    streamBusy,
    prompt,
    effectiveMode,
    selectedSkillId,
    polishCandidates,
    onInteractionHint,
    textareaRef,
    submitEcommerce,
    activeSkillId,
    buildReferenceSources,
    resolveProductAssetId,
    modelId,
    homeDirectSubmit,
    user,
    onAuthRequired,
    creationLane,
    sessionId,
    mode,
    router,
    shouldNavigateOnSubmit,
    assetIds,
    uploadPreviews,
    focusEdit,
    onFocusEditSubmit,
    canvasItems,
    setPrompt,
    refreshUser,
    onJobStarted,
    isStudioDock,
    aspectRatio,
    count,
    resolution,
    videoReferenceMode,
    videoDurationSec,
    videoResolution,
    videoReferences,
    smartMultiShots,
    firstLastMotionPrompt,
    mentionedMasks,
    models,
    videoRoutes,
    videoAutoMeta,
    referenceAssetId,
    productAssetId,
    studioOrchestrationActive,
    studioOrch,
    orchAgentRun,
    orchSkillRun,
    confirmAgentRun,
    startAgentRun,
    confirmSkillRun,
    startSkillRun,
    clearAttachmentState,
    setMentionedMasks,
    setDockSkillId,
    setReferences,
    skillsEnabled,
    agentEnabled,
    isDock,
    submitVideo,
    dramaOrchestrationActive,
    setRouteHint,
    setProductAssetId,
    setReferenceAssetId,
    brand,
    platform,
    market,
    language,
    designer,
    autoSubmitOnce,
  } = input;

  const [pending, setPending] = useState(false);
  const [navigating, setNavigating] = useState(false);

  async function handleSubmit() {
    if (readOnly) return;
    if (!prompt.trim() && !submitEcommerce && !activeSkillId) {
      onInteractionHint?.("请先输入描述，再点击生成");
      textareaRef.current?.focus();
      return;
    }
    if (submitEcommerce || (activeSkillId && activeSkillId !== DRAMA_SKILL_ID)) {
      if (prompt.trim().length < 10) {
        alert("请填写至少 10 字的产品卖点/描述");
        return;
      }
      if (!resolveProductAssetId()) {
        alert("请先上传商品图（上传附件或产品图）");
        return;
      }
    }

    const referenceImageSources = buildReferenceSources();
    const hasRefs = hasReferenceImages(referenceImageSources);
    if (hasRefs && modelId === AUTO_MODEL_ID) {
      try {
        const providerStatus = await fetchProviderStatus();
        const i2iReady =
          providerStatus.seedreamConfigured ||
          (providerStatus.aliyunWanConfigured &&
            Boolean(providerStatus.aliyunWanI2iConfigured));
        if (!i2iReady) {
          const proceed = confirm(
            "您引用了参考图片，但未配置图生图 API key。\n\n" +
            "当前将使用文生图流程，生成效果可能无法参考您引用的图片。\n\n" +
            "建议：\n" +
            "1. 配置 ARK_API_KEY（火山方舟 Seedream，推荐）\n" +
            "2. 配置 DASHSCOPE_API_KEY（阿里云万相）\n\n" +
            "是否继续提交？（继续将走文生图流程）"
          );
          if (!proceed) return;
        }
      } catch (err) {
        console.warn("Failed to check provider status:", err);
      }
    }

    if (homeDirectSubmit && !user) {
      onAuthRequired?.("登录后即可开始生成");
      return;
    }

    if (homeDirectSubmit && creationLane === "agent") {
      const trimmed = prompt.trim();
      if (!trimmed) {
        onInteractionHint?.("请输入你想完成的目标");
        return;
      }
      setNavigating(true);
      persistCreationLane("studio", creationLane);
      try {
        await ensureSession(sessionId!, mode, {
          title: trimmed.slice(0, 40),
        });
      } catch {
        /* 仍跳转 Studio，由编排侧再次 ensure */
      }
      const params = new URLSearchParams({
        sessionId: sessionId!,
        mode,
        q: trimmed,
        submit: "1",
      });
      clientNavigate(router, `/studio?${params.toString()}`);
      return;
    }

    const shouldNavigate = shouldNavigateOnSubmit;

    if (shouldNavigate) {
      const id = sessionId ?? randomUUID();
      const params = new URLSearchParams({ sessionId: id, mode });
      if (prompt.trim()) params.set("q", prompt.trim());
      if (assetIds.length && uploadPreviews.length) {
        storePendingAssets(
          id,
          uploadPreviews.map((p) => ({ id: p.id, url: p.url })),
        );
      } else if (assetIds.length) {
        storePendingAssets(
          id,
          assetIds.map((aid) => ({ id: aid, url: "" })),
        );
      }
      clientNavigate(router, `/studio?${params.toString()}`);
      return;
    }

    if (!user) {
      onAuthRequired?.("登录后即可开始生成");
      return;
    }
    if (!sessionId) return;

    if (focusEdit?.points.length && onFocusEditSubmit) {
      const sourceItem = canvasItems.find(
        (i) => i.id === focusEdit.points[0]?.itemId,
      );
      if (!sourceItem) {
        alert("找不到焦点对应的画布图片，请重新点选");
        return;
      }
      setPending(true);
      try {
        await ensureSession(sessionId, mode);
        const jobId = await onFocusEditSubmit({
          prompt: prompt.trim(),
          intent: focusEdit.intent,
          points: focusEdit.points,
          item: sourceItem,
        });
        setPrompt("");
        await refreshUser();
        void trackEvent("focus_edit_submit", {
          sessionId,
          intent: focusEdit.intent,
          count: focusEdit.points.length,
        });
        onJobStarted?.(jobId);
      } catch (err) {
        alert(err instanceof Error ? err.message : "焦点编辑提交失败");
      } finally {
        setPending(false);
      }
      return;
    }

    if (isStudioDock) {
      setPending(true);
      try {
        const result = await runStudioSubmit({
          readOnly,
          sessionId,
          mode,
          prompt,
          creationLane,
          activeSkillId,
          modelId,
          aspectRatio,
          count,
          resolution,
          videoReferenceMode,
          videoDurationSec,
          videoResolution,
          videoReferences,
          smartMultiShots,
          firstLastMotionPrompt,
          canvasItems,
          referenceImageSources,
          mentionedMasks,
          models,
          videoRoutes,
          videoAutoMeta,
          productAssetId: resolveProductAssetId(),
          referenceAssetId: referenceAssetId ?? undefined,
          studioOrchestrationActive,
          studioOrch: studioOrch ?? null,
          agentRun: orchAgentRun,
          skillRun: orchSkillRun,
          confirmAgentRun,
          startAgentRun,
          confirmSkillRun,
          startSkillRun,
        });
        if (result.status !== "direct") return;
        setPrompt("");
        clearAttachmentState();
        setMentionedMasks([]);
        setDockSkillId(null);
        await refreshUser();
        void trackEvent("generation_submit", { mode, sessionId });
        onJobStarted?.(result.jobId, result.lineage);
        const refs = await fetchReferences(sessionId);
        setReferences(refs);
      } catch (err) {
        alert(err instanceof Error ? err.message : "提交失败");
      } finally {
        setPending(false);
      }
      return;
    }

    const focusEditActive = Boolean(focusEdit?.points.length);
    const submitPath = resolveCreationSubmitPathFromContext({
      studioOrchestrationActive,
      skillsEnabled,
      agentEnabled,
      isDock,
      creationLane,
      activeSkillId,
      focusEditActive,
      mentionedMasksCount: mentionedMasks.length,
      submitVideo,
      submitEcommerce,
      referenceImageSources,
      dramaSkillActive: dramaOrchestrationActive,
    });

    setPending(true);
    try {
      const dispatchResult = await dispatchCreationSubmit({
        submitPath,
        sessionId,
        mode,
        effectiveMode,
        prompt,
        creationLane,
        activeSkillId,
        focusEditActive,
        mentionedMasksCount: mentionedMasks.length,
        submitVideo,
        hasReferenceImages: hasRefs,
        productAssetId: resolveProductAssetId(),
        referenceAssetId: referenceAssetId ?? undefined,
        studioOrch: studioOrch ?? null,
        agentRun: orchAgentRun,
        skillRun: orchSkillRun,
        confirmAgentRun,
        startAgentRun,
        confirmSkillRun,
        startSkillRun,
        onAgentStarted: () => {
          void trackEvent("agent_run_start", {
            sessionId: sessionId ?? "",
            mode,
          });
        },
        onSkillStarted: () => {
          void trackEvent("skill_run_start", {
            sessionId: sessionId ?? "",
            skillId: activeSkillId ?? "",
          });
        },
        directGeneration: {
          submitVideo,
          submitEcommerce,
          modelId,
          aspectRatio,
          count,
          resolution,
          videoReferenceMode,
          videoDurationSec,
          videoResolution,
          videoReferences,
          smartMultiShots,
          firstLastMotionPrompt,
          canvasItems,
          referenceImageSources,
          mentionedMasks,
          models,
          videoRoutes,
          videoAutoMeta,
          brand,
          platform,
          market,
          language,
          designer,
          productAssetId,
          referenceAssetId,
        },
      });

      if (dispatchResult.kind === "orchestration" && dispatchResult.handled) {
        return;
      }
      if (dispatchResult.kind === "skill") {
        if (
          dispatchResult.result === "validation_failed" ||
          dispatchResult.result === "in_flight"
        ) {
          return;
        }
        return;
      }
      if (dispatchResult.kind === "agent") {
        if (dispatchResult.result === "in_flight") return;
        return;
      }
      if (dispatchResult.kind !== "direct") return;

      const jobId = dispatchResult.jobId;
      const submitLineage = dispatchResult.lineage;
      if (dispatchResult.routeReason) setRouteHint(dispatchResult.routeReason);
      else if (dispatchResult.byokActive) {
        setRouteHint("BYOK 已启用 · 将使用您的 OpenAI Key");
      }
      if (submitEcommerce) {
        setProductAssetId(null);
        setReferenceAssetId(null);
      }
      if (homeDirectSubmit) {
        persistCreationLane("studio", creationLane);
        setNavigating(true);
        clientNavigate(
          router,
          `/studio?sessionId=${encodeURIComponent(sessionId)}&mode=${encodeURIComponent(mode)}&jobId=${encodeURIComponent(jobId)}`,
          "replace",
        );
      }
      setPrompt("");
      clearAttachmentState();
      setMentionedMasks([]);
      setDockSkillId(null);
      await refreshUser();
      void trackEvent("generation_submit", { mode, sessionId });
      onJobStarted?.(jobId, submitLineage);
      if (sessionId) {
        const refs = await fetchReferences(sessionId);
        setReferences(refs);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "提交失败");
    } finally {
      setPending(false);
    }
  }

  function handleSubmitAttempt() {
    if (readOnly || pending || streamBusy) return;
    if (
      !prompt.trim() &&
      effectiveMode !== "ecommerce" &&
      !selectedSkillId
    ) {
      onInteractionHint?.("请先输入描述，再点击开始生成");
      textareaRef.current?.focus();
      return;
    }
    if (polishCandidates.includes(prompt.trim())) {
      recordAcceptedPrompt(prompt.trim());
    }
    void handleSubmit();
  }

  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;

  useImperativeHandle(panelRef, () => ({
    submit: () => {
      void handleSubmitRef.current();
    },
  }));

  const autoSubmitFiredRef = useRef(false);
  useEffect(() => {
    if (!autoSubmitOnce || autoSubmitFiredRef.current || readOnly) return;
    if (!isStudioDock || !prompt.trim() || !user || !sessionId) return;
    autoSubmitFiredRef.current = true;
    const t = window.setTimeout(() => {
      void handleSubmitRef.current();
    }, 350);
    return () => window.clearTimeout(t);
  }, [autoSubmitOnce, isStudioDock, prompt, user, sessionId, readOnly]);

  return {
    pending,
    navigating,
    handleSubmit,
    handleSubmitAttempt,
  };
}
