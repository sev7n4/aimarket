import type { CreationMode } from "@aimarket/ui";

import type { AspectRatio } from "@/components/generation-settings-popover";
import {
  ensureSession,
  fetchProviderStatus,
  getVideoModelRoute,
  submitEcommerceGenerate,
  submitGeneration,
  submitVideoGeneration,
} from "@/lib/api-client";
import type { ImageModel, VideoModelRouteMeta, AgentRun, SkillRun } from "@/lib/types";
import { resolveVideoSubmitModelId, type VideoAutoMeta } from "@/lib/video-auto-model";
import { validateOmniVideoMentions } from "@/lib/video-mention";
import type { StudioOrchestrationContextValue } from "@/components/studio-orchestration-provider";
import {
  pendingLineageToApiFields,
  resolveSubmitBatchLineage,
  type CanvasItem,
  type CanvasMaskSelection,
  type PendingBatchLineage,
} from "@/lib/canvas-tools";
import type { CreationLane } from "@/lib/creation-dock-prefs";
import type {
  SmartMultiShot,
  VideoDurationSec,
  VideoMediaRef,
  VideoReferenceMode,
  VideoResolution,
} from "@/lib/creation-dock-prefs";
import {
  buildDirectSubmitContext,
  buildOrchestrationDispatchContext,
  hasReferenceImages,
  normalizeReferenceOutputIds,
  resolveCreationSubmitPath,
  shouldOrchestrationHandleSubmit,
  type ReferenceImageSources,
} from "@/lib/creation-lane-submit";
import { AUTO_MODEL_ID } from "@/lib/creation-lane-drafts";
import {
  submitAgentOrchestration,
  submitSkillOrchestration,
} from "@/lib/creation-orchestration-submit";
import { shouldUseDramaOrchestration } from "@/lib/drama-submit-routing";

const ASPECT_RATIOS: AspectRatio[] = [
  "auto",
  "1:1",
  "4:3",
  "3:4",
  "16:9",
  "9:16",
  "3:2",
  "2:3",
  "4:5",
  "5:4",
  "21:9",
];

export function coerceStudioAspectRatio(value: string): AspectRatio {
  if (value === "auto" || !value) return "1:1";
  return ASPECT_RATIOS.includes(value as AspectRatio)
    ? (value as AspectRatio)
    : "1:1";
}

export function studioVideoSubmitAspectRatio(aspectRatio: string): string {
  if (aspectRatio === "auto") return "16:9";
  return aspectRatio;
}

function capabilityDegradationMessage(
  modelId: string,
  videoReferenceMode: VideoReferenceMode,
  videoRoutes: VideoModelRouteMeta[],
): string | undefined {
  const route =
    getVideoModelRoute(modelId) ?? videoRoutes.find((r) => r.modelId === modelId);
  if (!route?.capabilities) return undefined;
  const c = route.capabilities;
  if (videoReferenceMode === "omni" && c.omni === "image-only") {
    return "当前模型在全能参考模式下将降级为仅使用首张图片";
  }
  if (videoReferenceMode === "first-last" && c.firstLast === "first-only") {
    return "当前模型在首尾帧模式下将降级为仅首帧";
  }
  if (videoReferenceMode === "smart-multi-frame" && c.smartMultiFrame === "degraded") {
    return "当前模型在智能多帧模式下将合并 prompt 与首图";
  }
  return undefined;
}

export type StudioDirectGenerationInput = {
  sessionId: string;
  mode: CreationMode;
  prompt: string;
  creationLane: CreationLane;
  submitVideo: boolean;
  submitEcommerce: boolean;
  modelId: string;
  aspectRatio: string;
  count: number;
  resolution: string;
  videoReferenceMode: VideoReferenceMode;
  videoDurationSec: VideoDurationSec;
  videoResolution: VideoResolution;
  videoReferences: VideoMediaRef[];
  smartMultiShots: SmartMultiShot[];
  firstLastMotionPrompt: string;
  canvasItems: CanvasItem[];
  referenceImageSources: ReferenceImageSources;
  mentionedMasks: CanvasMaskSelection[];
  models: ImageModel[];
  videoRoutes: VideoModelRouteMeta[];
  videoAutoMeta: VideoAutoMeta | null;
  brand?: string;
  platform?: string;
  market?: string;
  language?: string;
  designer?: string;
  productAssetId?: string | null;
  referenceAssetId?: string | null;
  confirm?: (message: string) => boolean;
};

export type StudioDirectGenerationResult = {
  jobId: string;
  lineage?: PendingBatchLineage;
  routeReason?: string;
  byokActive?: boolean;
};

/** 直接生成路径：图片 / 视频 / 电商 API 提交（纯 async，可单测） */
export async function submitStudioDirectGeneration(
  input: StudioDirectGenerationInput,
): Promise<StudioDirectGenerationResult> {
  const {
    sessionId,
    mode,
    prompt,
    creationLane,
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
    platform = "taobao",
    market = "cn",
    language = "zh",
    designer,
    productAssetId,
    referenceAssetId,
    confirm = (message) => window.confirm(message),
  } = input;

  await ensureSession(sessionId, mode, {
    title: prompt.trim() ? prompt.trim().slice(0, 40) : undefined,
  });

  const submitLineage = resolveSubmitBatchLineage(canvasItems, {
    maskSelection:
      mentionedMasks.length > 0
        ? mentionedMasks[mentionedMasks.length - 1]
        : null,
    referenceOutputIds:
      referenceImageSources.selectedRefIds.length > 0
        ? referenceImageSources.selectedRefIds
        : undefined,
    toolName: mentionedMasks[mentionedMasks.length - 1]?.toolId,
  });
  const lineageApi = pendingLineageToApiFields(submitLineage);

  if (submitVideo) {
    const videoModel = models.find((m) => m.type === "video");
    if (!videoModel) {
      throw new Error("当前暂无可用视频模型");
    }
    const videoModelId = resolveVideoSubmitModelId(modelId, models, videoAutoMeta);
    const route =
      getVideoModelRoute(videoModelId) ??
      videoRoutes.find((r) => r.modelId === videoModelId);
    if (route && !route.available) {
      throw new Error(route.unavailableReason ?? "该视频模型当前不可用");
    }
    const degradeHint = capabilityDegradationMessage(
      videoModelId,
      videoReferenceMode,
      videoRoutes,
    );
    if (degradeHint && !confirm(`${degradeHint}，是否继续？`)) {
      throw new Error("已取消提交");
    }
    if (videoReferenceMode === "omni" && videoReferences.length > 0) {
      const mentionCheck = validateOmniVideoMentions(prompt, videoReferences);
      if (!mentionCheck.ok) {
        throw new Error(mentionCheck.message ?? "请检查 @ 引用");
      }
    }
    const videoAssetIds = Array.from(
      new Set([
        ...referenceImageSources.assetIds,
        ...referenceImageSources.mentionedAssetIds,
      ]),
    );
    const structuredRefs =
      videoReferenceMode === "omni" || videoReferenceMode === "first-last"
        ? videoReferences.map(({ assetId, mediaType, role }) => ({
            assetId,
            mediaType,
            role,
          }))
        : undefined;
    const shotsPayload =
      videoReferenceMode === "smart-multi-frame"
        ? smartMultiShots
            .filter((s) => s.motionPrompt.trim())
            .map((s, i) => ({
              order: i,
              assetId: s.assetId,
              motionPrompt: s.motionPrompt.trim(),
            }))
        : undefined;
    const mergedPrompt =
      videoReferenceMode === "first-last" && firstLastMotionPrompt.trim()
        ? `${prompt.trim()}\n\n运动描述：${firstLastMotionPrompt.trim()}`
        : prompt.trim();
    const res = await submitVideoGeneration({
      sessionId,
      prompt: mergedPrompt,
      modelId: videoModelId,
      count,
      resolution,
      aspectRatio: studioVideoSubmitAspectRatio(aspectRatio),
      videoResolution,
      referenceMode: videoReferenceMode,
      durationSec: videoDurationSec,
      videoReferences: structuredRefs?.length ? structuredRefs : undefined,
      smartMultiShots: shotsPayload?.length ? shotsPayload : undefined,
      assetIds:
        videoReferenceMode === "omni" && videoAssetIds.length
          ? videoAssetIds
          : undefined,
      referenceOutputIds: normalizeReferenceOutputIds(
        referenceImageSources.selectedRefIds,
      ),
      sourceLane: "video",
      ...lineageApi,
    });
    return { jobId: res.jobId, lineage: submitLineage };
  }

  if (submitEcommerce) {
    const res = await submitEcommerceGenerate({
      sessionId,
      brand: brand || undefined,
      platform,
      market,
      language,
      productInfo: prompt.trim(),
      designer,
      resolution,
      productAssetId: productAssetId ?? undefined,
      referenceAssetId: referenceAssetId ?? undefined,
    });
    return { jobId: res.jobId, lineage: submitLineage, routeReason: res.routeReason };
  }

  const useAuto = modelId === AUTO_MODEL_ID;
  const mergedAssetIds = Array.from(
    new Set([
      ...referenceImageSources.assetIds,
      ...referenceImageSources.mentionedAssetIds,
    ]),
  );
  const toolEdit = mentionedMasks.length > 0;
  const res = await submitGeneration({
    sessionId,
    prompt: prompt.trim(),
    modelId: useAuto ? undefined : modelId,
    count: toolEdit ? 1 : count,
    resolution,
    aspectRatio: coerceStudioAspectRatio(aspectRatio),
    mode: mode === "ecommerce" ? "ecommerce" : "image",
    assetIds: mergedAssetIds.length ? mergedAssetIds : undefined,
    referenceOutputIds: normalizeReferenceOutputIds(
      referenceImageSources.selectedRefIds,
    ),
    autoRoute: useAuto,
    sourceLane: creationLane === "video" ? "video" : "image",
    toolContext: mentionedMasks.length
      ? {
          toolId: mentionedMasks[mentionedMasks.length - 1].toolId,
          masks: mentionedMasks.map((m) => ({
            itemId: m.itemId,
            mode: m.mode,
            maskDataUrl: m.maskDataUrl,
            bbox: m.bbox,
            normalizedBbox: m.normalizedBbox,
          })),
        }
      : undefined,
    ...lineageApi,
  });
  return {
    jobId: res.jobId,
    lineage: submitLineage,
    routeReason: res.routeReason,
    byokActive: res.byokActive,
  };
}

export type RunStudioSubmitInput = {
  readOnly: boolean;
  sessionId: string;
  mode: CreationMode;
  prompt: string;
  creationLane: CreationLane;
  activeSkillId: string | null;
  modelId: string;
  aspectRatio: string;
  count: number;
  resolution: string;
  videoReferenceMode: VideoReferenceMode;
  videoDurationSec: VideoDurationSec;
  videoResolution: VideoResolution;
  videoReferences: VideoMediaRef[];
  smartMultiShots: SmartMultiShot[];
  firstLastMotionPrompt: string;
  canvasItems: CanvasItem[];
  referenceImageSources: ReferenceImageSources;
  mentionedMasks: CanvasMaskSelection[];
  models: ImageModel[];
  videoRoutes: VideoModelRouteMeta[];
  videoAutoMeta: VideoAutoMeta | null;
  productAssetId?: string | null;
  referenceAssetId?: string | null;
  studioOrchestrationActive: boolean;
  studioOrch: StudioOrchestrationContextValue | null;
  agentRun: AgentRun | null | undefined;
  skillRun: SkillRun | null | undefined;
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
  onAlert?: (message: string) => void;
  onConfirm?: (message: string) => boolean;
};

export type RunStudioSubmitResult =
  | { status: "blocked" }
  | { status: "orchestration" }
  | { status: "direct"; jobId: string; lineage?: PendingBatchLineage };

/** Studio 提交主线：路径决策 + 编排 / 直接生成 */
export async function runStudioSubmit(
  input: RunStudioSubmitInput,
): Promise<RunStudioSubmitResult> {
  const {
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
    productAssetId,
    referenceAssetId,
    studioOrchestrationActive,
    studioOrch,
    agentRun,
    skillRun,
    confirmAgentRun,
    startAgentRun,
    confirmSkillRun,
    startSkillRun,
    onAlert = (message) => alert(message),
    onConfirm = (message) => window.confirm(message),
  } = input;

  if (readOnly) return { status: "blocked" };
  if (!prompt.trim() && !activeSkillId) {
    onAlert("请先输入描述，再点击生成");
    return { status: "blocked" };
  }

  const hasRefs = hasReferenceImages(referenceImageSources);
  if (hasRefs && modelId === AUTO_MODEL_ID) {
    try {
      const providerStatus = await fetchProviderStatus();
      const i2iReady =
        providerStatus.seedreamConfigured ||
        (providerStatus.aliyunWanConfigured &&
          Boolean(providerStatus.aliyunWanI2iConfigured));
      if (!i2iReady) {
        const proceed = onConfirm(
          "您引用了参考图片，但未配置图生图 API key。\n\n" +
            "当前将使用文生图流程，生成效果可能无法参考您引用的图片。\n\n" +
            "建议：\n" +
            "1. 配置 ARK_API_KEY（火山方舟 Seedream，推荐）\n" +
            "2. 配置 DASHSCOPE_API_KEY（阿里云万相）\n\n" +
            "是否继续提交？（继续将走文生图流程）",
        );
        if (!proceed) return { status: "blocked" };
      }
    } catch (err) {
      console.warn("Failed to check provider status:", err);
    }
  }

  const effectiveMode: CreationMode = mode === "ecommerce" ? "chat" : mode;
  const submitEcommerce = false;
  const submitVideo = creationLane === "video";
  const focusEditActive = false;

  const dramaOrchestrationActive = shouldUseDramaOrchestration({
    creationLane,
    activeSkillId,
    prompt,
    effectiveMode,
    hasDramaSessionState: Boolean(
      studioOrch?.dramaPlanRun ||
        studioOrch?.dramaDraftProject ||
        studioOrch?.dramaRun,
    ),
  });

  const directSubmitContext = buildDirectSubmitContext({
    studioOrchestrationActive,
    skillsEnabled: false,
    agentEnabled: studioOrchestrationActive,
    isDock: true,
    creationLane,
    activeSkillId,
    focusEditActive,
    mentionedMasksCount: mentionedMasks.length,
    submitVideo,
    submitEcommerce,
    referenceImageSources,
  });
  const orchestrationDispatchWouldHandle =
    studioOrchestrationActive &&
    shouldOrchestrationHandleSubmit(
      buildOrchestrationDispatchContext({
        creationLane,
        activeSkillId,
        focusEditActive,
        mentionedMasksCount: mentionedMasks.length,
        submitVideo,
        referenceImageSources,
        dramaSkillActive: dramaOrchestrationActive,
      }),
    );
  const submitPath = resolveCreationSubmitPath({
    direct: directSubmitContext,
    orchestrationDispatchWouldHandle,
  });

  if (submitPath === "orchestration" && studioOrch) {
    const handled = await studioOrch.dispatchSubmit({
      prompt,
      creationLane,
      activeSkillId,
      effectiveMode,
      focusEditActive,
      mentionedMasksCount: mentionedMasks.length,
      submitVideo,
      hasReferenceImages: hasRefs,
      productAssetId: productAssetId ?? undefined,
      referenceAssetId: referenceAssetId ?? undefined,
    });
    if (handled) return { status: "orchestration" };
  }

  if (submitPath === "skill" && activeSkillId) {
    const skillResult = await submitSkillOrchestration({
      prompt,
      activeSkillId,
      productAssetId: productAssetId ?? undefined,
      referenceAssetId: referenceAssetId ?? undefined,
      skillRun,
      ensureSession: () => ensureSession(sessionId, mode),
      confirmRun: confirmSkillRun,
      startRun: startSkillRun,
      onValidationError: onAlert,
    });
    if (skillResult !== "started" && skillResult !== "confirm") {
      return { status: "blocked" };
    }
    return { status: "orchestration" };
  }

  if (submitPath === "agent") {
    const agentResult = await submitAgentOrchestration({
      prompt,
      agentRun: agentRun as AgentRun | null | undefined,
      ensureSession: () => ensureSession(sessionId, mode),
      confirmRun: confirmAgentRun,
      startRun: startAgentRun,
    });
    if (agentResult === "in_flight") return { status: "blocked" };
    return { status: "orchestration" };
  }

  const direct = await submitStudioDirectGeneration({
    sessionId,
    mode,
    prompt,
    creationLane,
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
    productAssetId,
    referenceAssetId,
    confirm: onConfirm,
  });
  return { status: "direct", jobId: direct.jobId, lineage: direct.lineage };
}
