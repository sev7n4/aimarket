"use client";

import type { ReactNode, Ref } from "react";
import type { CreationPanelHandle, CreationPanelProps } from "@/components/creation-panel-types";

import { useRouter } from "next/navigation";
import { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  AtSign,
  ImagePlus,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  Button,
  ModeTabs,
  type CreationMode,
} from "@aimarket/ui";
import { modeTabs, placeholders, PRODUCTION_DOCK_PLACEHOLDER, toApiCreationMode } from "@/lib/modes";
import {
  assetUrl,
  ensureSession,
  fetchSession,
  estimatePoints,
  getToken,
  fetchModels,
  getVideoAutoModelMeta,
  getVideoModelRoute,
  getVideoModelRoutesMeta,
  fetchReferences,
  fetchProviderStatus,
  suggestModel,
  uploadAsset,
  registerAssetFromUrl,
  trackEvent,
  optimizePromptApi,
  renderInspiration,
} from "@/lib/api-client";
import { polishPrompt } from "@/lib/prompt-polish";
import { resolveIntent } from "@/lib/intent-router";
import {
  readRecentAcceptedPrompts,
  recordAcceptedPrompt,
} from "@/lib/prompt-style-profile";
import {
  resolveVideoSubmitModelId,
  videoAutoPickerLabel,
  type VideoAutoMeta,
} from "@/lib/video-auto-model";
import type { ImageModel, VideoModelRouteMeta } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import {
  MentionPicker,
  canvasItemToMentionItem,
} from "@/components/mention-picker";
import {
  type CanvasItem,
  type CanvasMaskSelection,
  type PendingBatchLineage,
} from "@/lib/canvas-tools";
import type { SessionReference } from "@/lib/types";
import { useRotatingPlaceholder } from "@/hooks/use-rotating-placeholder";
import { randomUUID } from "@/lib/uuid";
import { clientNavigate } from "@/lib/client-navigate";
import { storePendingAssets, type PendingAsset } from "@/lib/pending-assets";
import { CreationPanelPill } from "@/components/creation-panel-primitives";
import { CreationPanelView } from "@/components/creation-panel-view";
import { CreationPanelInspirationVars } from "@/components/creation-panel-inspiration-vars";
import { CreationPanelJobStatusBar } from "@/components/creation-panel-job-status-bar";
import { useCreationDockDrag } from "@/hooks/use-creation-dock-drag";
import { useCreationPanelAssets } from "@/hooks/use-creation-panel-assets";
import {
  UploadPreviewStack,
  type UploadPreviewItem,
} from "@/components/upload-preview-stack";

import {
  GenerationSettingsPopover,
  type AspectRatio,
} from "@/components/generation-settings-popover";
import { ModelPicker, AUTO_MODEL_ID } from "@/components/model-picker";
import { normalizeLaneModelId } from "@/lib/creation-lane-drafts";
import { isInternalRoutingModelId } from "@/lib/format-generation-display";
import { CountPicker } from "@/components/count-picker";
import type { StudioInspirationApply } from "@/lib/inspiration-studio";
import { FocusEditChips } from "@/components/focus-edit-chips";
import { AgentRunPanel } from "@/components/agent-run-panel";
import { SkillPackagePicker } from "@/components/skill-package-picker";
import { SkillRunPanel } from "@/components/skill-run-panel";
import { useAgentRun } from "@/hooks/use-agent-run";
import { useSkillRun } from "@/hooks/use-skill-run";
import type { AgentRunStatus, SkillRunStatus } from "@/lib/types";
import { useStudioOrchestrationOptional } from "@/components/studio-orchestration-provider";
import {
  CreationDockToolbar,
  CreationLanePicker,
  DRAMA_SKILL_ID,
  ECOMMERCE_SET_SKILL_ID,
  normalizeDockSkillId,
} from "@/components/creation-dock-controls";
import { shouldUseDramaOrchestration } from "@/lib/drama-submit-routing";
import {
  persistCreationLane,
  CREATION_LANE_PLACEHOLDERS,
  type CreationDockScope,
  type CreationLane,
  type OutputPreferenceMode,
  type SmartMultiShot,
  type VideoDurationSec,
  type VideoMediaRef,
  type VideoReferenceMode,
  type VideoResolution,
} from "@/lib/creation-dock-prefs";
import { VideoReferenceDockControl } from "@/components/video-reference-slots";
import { applyModeVideoSettings } from "@/components/video-output-settings";
import {
  assignOmniRefLabels,
  validateOmniVideoMentions,
} from "@/lib/video-mention";
import { useCreationLaneDrafts } from "@/hooks/use-creation-lane-drafts";
import { useVideoPickCandidates } from "@/hooks/use-video-pick-candidates";
import {
  resolveCanvasItemForVideoPick,
  routePickToVideoSlots,
  type VideoPickCandidate,
} from "@/lib/canvas-video-reference-bind";
import { ReferenceChips } from "@/components/reference-chips";
import { extractMentionLabelsFromPrompt } from "@/lib/mention-sync";
import {
  hasReferenceImages,
  normalizeReferenceOutputIds,
  resolveCreationSubmitPathFromContext,
} from "@/lib/creation-lane-submit";
import {
  dispatchCreationSubmit,
} from "@/lib/creation-submit-dispatch";
import {
  isAgentAwaitingConfirm,
  isAgentRunInFlight,
  isSkillAwaitingConfirm,
  isSkillRunInFlight,
} from "@/lib/creation-orchestration-submit";
import { runStudioSubmit } from "@/lib/studio-submit";
import type { StudioDockMode } from "@/lib/studio-dock-state";
import type {
  FocusEditIntent,
  FocusPointChip,
} from "@/lib/focus-edit";

const ASPECT_RATIOS: AspectRatio[] = [
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

function coerceAspectRatio(value: string): AspectRatio {
  if (value === "auto" || !value) return "1:1";
  return ASPECT_RATIOS.includes(value as AspectRatio) ?
      (value as AspectRatio)
    : "1:1";
}

export function useCreationPanel(
  {
  initialMode = "chat",
  initialPrompt = "",
  compact = false,
  variant = "default",
  mode: controlledMode,
  onModeChange,
  showModeTabs = true,
  sessionId,
  onAuthRequired,
  onInteractionHint,
  submitOnEnter = false,
  onJobStarted,
  jobStreamStatus = null,
  pollingJobId = null,
  onCancelJob,
  jobElapsedMs,
  queueAhead,
  homeDirectSubmit = false,
  autoSubmitOnce = false,
  navigateOnSubmit,
  leadingUpload = false,
  enablePolish = false,
  rotatingPlaceholder = false,
  readOnly = false,
  restoredAssets,
  inspirationApply = null,
  onInspirationClick,
  inspirationCoverUrl,
  inspirationActive = false,
  collapsed = false,
  initialDockExpanded = false,
  dockLineOnly = false,
  onDockModeChange,
  canvasItems = [],
  mentionItemRequest = null,
  focusEdit = null,
  onFocusEditSubmit,
  prompt: controlledPrompt,
  onPromptChange,
  onUploadToCanvas,
  selectedCanvasItem = null,
  onClearCanvasSelection,
  agentOrchestration = false,
  agentSkills = false,
  onAgentRunComplete,
}: CreationPanelProps, ref: Ref<CreationPanelHandle>): ReactNode {
  const studioOrch = useStudioOrchestrationOptional();
  const isStudioDock = variant === "studio-dock";
  const studioOrchestrationActive = isStudioDock && studioOrch != null;
  const shouldNavigateOnSubmit =
    navigateOnSubmit ?? (!sessionId && !homeDirectSubmit);
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [internalMode, setInternalMode] = useState<CreationMode>(initialMode);
  const mode = controlledMode ?? internalMode;
  const setMode = (m: CreationMode) => {
    setInternalMode(m);
    onModeChange?.(m);
  };
  const [internalPrompt, setInternalPrompt] = useState(initialPrompt);
  const prompt = controlledPrompt ?? internalPrompt;
  const setPrompt = (p: string | ((prev: string) => string)) => {
    const next = typeof p === "function" ? p(prompt) : p;
    setInternalPrompt(next);
    onPromptChange?.(next);
  };
  // 电商套图批量入口已下线，CreationPanel 仅保留单张生成能力。
  // 这些字段仅在历史兼容路径（非 dock variant）保留默认值
  const brand = "";
  const platform = "淘宝";
  const market = "中国";
  const language = "中文";
  const designer = "Gloria";
  const [models, setModels] = useState<ImageModel[]>([]);
  const [videoAutoMeta, setVideoAutoMeta] = useState<VideoAutoMeta | null>(
    null,
  );
  const [videoRoutes, setVideoRoutes] = useState<VideoModelRouteMeta[]>([]);
  const [estimated, setEstimated] = useState<number | null>(null);
  const [routeHint, setRouteHint] = useState<string | null>(null);
  const [inspirationVars, setInspirationVars] = useState<
    Record<string, string>
  >({});
  const [pending, setPending] = useState(false);
  const [polishBusy, setPolishBusy] = useState(false);
  const [polishHint, setPolishHint] = useState<string | null>(null);
  const [polishCandidates, setPolishCandidates] = useState<string[]>([]);
  const [polishCandidateIndex, setPolishCandidateIndex] = useState(0);
  const [references, setReferences] = useState<SessionReference[]>([]);
  const [dockExpanded, setDockExpanded] = useState(
    () => initialDockExpanded && !dockLineOnly,
  );
  const [dockFocused, setDockFocused] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [mentionedMasks, setMentionedMasks] = useState<CanvasMaskSelection[]>(
    [],
  );

  const rotatingText = useRotatingPlaceholder(
    mode,
    !rotatingPlaceholder || prompt.trim().length > 0,
  );
  const isDock = variant === "dock" || isStudioDock;
  /**
   * dock 模式（首页 + Studio 工作台）下统一走简洁对话流程，
   * 不再渲染电商 Agent 表单 / 走电商套图提交分支。
   */
  const effectiveMode: CreationMode = isDock && mode === "ecommerce" ? "chat" : mode;
  const agentEnabled =
    agentOrchestration &&
    Boolean(sessionId) &&
    isDock &&
    !readOnly;
  const agentLaneAvailable = agentOrchestration && isDock;
  const creationDockScope: CreationDockScope = isStudioDock ? "studio" : "home";

  const skillsEnabled = false;

  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const {
    creationLane,
    setCreationLane,
    laneSettings,
    setModelId,
    setAspectRatio,
    setCount,
    setResolution,
    setOutputPrefMode,
    setVideoReferenceMode,
    setVideoDurationSec,
    setVideoResolution,
    patchSettings,
  } = useCreationLaneDrafts(creationDockScope, {
    agentLaneAvailable,
  });
  const {
    modelId,
    aspectRatio,
    count,
    resolution,
    outputPrefMode,
    videoReferenceMode,
    videoDurationSec,
    videoResolution,
  } = laneSettings;
  const [videoReferences, setVideoReferencesState] = useState<VideoMediaRef[]>([]);
  const setVideoReferences = (refs: VideoMediaRef[]) => {
    setVideoReferencesState(assignOmniRefLabels(refs));
  };
  const [videoUploading, setVideoUploading] = useState(false);
  const [smartMultiShots, setSmartMultiShots] = useState<SmartMultiShot[]>([
    { order: 0, motionPrompt: "" },
    { order: 1, motionPrompt: "" },
  ]);
  const [firstLastMotionPrompt, setFirstLastMotionPrompt] = useState("");
  const selectedModel =
    modelId === AUTO_MODEL_ID ? undefined : models.find((m) => m.id === modelId);
  const isVideoModel = selectedModel?.type === "video";
  const [dockSkillId, setDockSkillId] = useState<string | null>(null);
  const sessionEnsuredRef = useRef(false);
  const normalizedDockSkillId = normalizeDockSkillId(dockSkillId);
  const activeSkillId = isDock ? normalizedDockSkillId : selectedSkillId;

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
  const submitEcommerce = !isDock && effectiveMode === "ecommerce";
  const submitVideo = isDock ? creationLane === "video" : isVideoModel;
  const focusEditActive = Boolean(focusEdit?.points.length);

  const assets = useCreationPanelAssets({
    sessionId,
    mode,
    user,
    homeDirectSubmit,
    restoredAssets,
    onAuthRequired,
    onUploadToCanvas,
    sessionEnsuredRef,
    prompt,
    setPrompt,
    textareaRef,
    canvasItems,
    selectedCanvasItem,
    onClearCanvasSelection,
    creationLane,
    focusEditActive,
    videoReferences,
    videoReferenceMode,
  });
  const {
    fileRef,
    uploadTargetRef,
    handleUploadRef,
    uploadTarget,
    assetIds,
    setAssetIds,
    productAssetId,
    setProductAssetId,
    referenceAssetId,
    setReferenceAssetId,
    uploading,
    selectedRefs,
    setSelectedRefs,
    mentionOpen,
    setMentionOpen,
    mentionQuery,
    setMentionQuery,
    mentionedAssetIds,
    setMentionedAssetIds,
    mentionedAssetPreviews,
    setMentionedAssetPreviews,
    uploadPreviews,
    setUploadPreviews,
    uploadPreviewIndex,
    setUploadPreviewIndex,
    reversing,
    buildReferenceSources,
    resolveProductAssetId,
    syncMentionStateFromPrompt,
    canvasReferenceActive,
    referenceChips,
    handleRemoveReferenceChip,
    insertMention,
    openUpload,
    handleUpload,
    handlePromptReverse,
    clearAttachmentState,
    mentionUploadedAssets,
  } = assets;

  const {
    skills: skillPackages,
    run: skillRun,
    busy: skillBusy,
    startRun: startSkillRun,
    confirmRun: confirmSkillRunAction,
    cancelRun: cancelSkillRunAction,
    resetRun: resetSkillRun,
  } = useSkillRun({
    sessionId,
    enabled: skillsEnabled && !studioOrchestrationActive,
    onJobStarted,
    onRunSettled: (run) => {
      if (run.status === "completed") {
        setPrompt("");
        clearAttachmentState();
        setMentionedMasks([]);
        setSelectedSkillId(null);
        setDockSkillId(null);
        void refreshUser();
        void trackEvent("skill_run_complete", {
          sessionId: sessionId ?? "",
          runId: run.id,
          skillId: run.skillId,
        });
      } else if (run.status === "failed" && run.error) {
        alert(run.error);
      }
      onAgentRunComplete?.();
      resetSkillRun();
    },
  });

  const selectedSkill =
    (studioOrchestrationActive ? studioOrch!.skillPackages : skillPackages)
      .find((s) => s.id === (activeSkillId ?? selectedSkillId)) ?? null;

  function handleVideoReferenceModeChange(mode: VideoReferenceMode) {
    const coerced = applyModeVideoSettings(
      mode,
      {
        aspectRatio,
        videoResolution,
        videoDurationSec,
      },
      smartMultiShots.length,
    );
    setVideoReferenceMode(mode);
    setAspectRatio(coerced.aspectRatio as AspectRatio);
    setVideoResolution(coerced.videoResolution);
    setVideoDurationSec(coerced.videoDurationSec);
  }

  async function uploadVideoReference(
    file: File,
    _role?: VideoMediaRef["role"],
  ) {
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
  }

  function videoSubmitAspectRatio(): string {
    if (aspectRatio === "auto") return "16:9";
    return aspectRatio;
  }

  function capabilityDegradationMessage(modelId: string): string | undefined {
    const route = getVideoModelRoute(modelId) ?? videoRoutes.find((r) => r.modelId === modelId);
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

  function handleCreationLaneChange(lane: CreationLane) {
    const refSources = buildReferenceSources();
    if (lane === "agent" && hasReferenceImages(refSources)) {
      onInteractionHint?.("Agent 模式暂不支持参考图，已切换到图片生成");
      lane = "image";
    }
    setCreationLane(lane);
    if (lane !== "agent") {
      setDockSkillId(null);
      setSelectedSkillId(null);
    }
  }

  function handleOutputPrefModeChange(mode: OutputPreferenceMode) {
    setOutputPrefMode(mode);
    if (mode === "auto") {
      setModelId(AUTO_MODEL_ID);
      setAspectRatio("auto");
    }
  }

  function handleDockSkillChange(id: string | null) {
    const normalized = normalizeDockSkillId(id);
    setDockSkillId(normalized);
    if (normalized) {
      setCreationLane("agent");
      setSelectedSkillId(normalized);
      return;
    }
    setSelectedSkillId(null);
  }

  useEffect(() => {
    if (!isDock || outputPrefMode !== "auto") return;
    if (creationLane === "video") {
      const vm = models.find((m) => m.type === "video");
      if (vm) setModelId(vm.id);
    } else {
      setModelId(AUTO_MODEL_ID);
      setAspectRatio("auto");
    }
  }, [isDock, outputPrefMode, creationLane, models, setModelId, setAspectRatio]);

  useEffect(() => {
    if (!isDock || models.length === 0) return;
    if (modelId === AUTO_MODEL_ID || isInternalRoutingModelId(modelId)) {
      if (modelId !== AUTO_MODEL_ID) setModelId(AUTO_MODEL_ID);
      return;
    }
    const laneModels =
      creationLane === "video"
        ? models.filter((m) => m.type === "video")
        : models.filter((m) => m.type === "image");
    if (laneModels.length > 0 && !laneModels.some((m) => m.id === modelId)) {
      setModelId(AUTO_MODEL_ID);
    }
  }, [isDock, models, modelId, creationLane, setModelId]);

  const {
    run: agentRun,
    busy: agentBusy,
    startRun: startAgentRun,
    confirmRun: confirmAgentRunAction,
    cancelRun: cancelAgentRunAction,
    resetRun: resetAgentRun,
  } = useAgentRun({
    sessionId,
    mode: effectiveMode,
    enabled: agentEnabled && !studioOrchestrationActive,
    onJobStarted,
    onRunSettled: (run) => {
      if (run.status === "completed") {
        setPrompt("");
        clearAttachmentState();
        setMentionedMasks([]);
        void refreshUser();
        void trackEvent("agent_run_complete", {
          sessionId: sessionId ?? "",
          runId: run.id,
        });
      } else if (run.status === "failed" && run.error) {
        alert(run.error);
      }
      onAgentRunComplete?.();
      resetAgentRun();
    },
  });

  const orchSkillRun = studioOrchestrationActive
    ? studioOrch!.skillRun
    : skillRun;
  const orchAgentRun = studioOrchestrationActive
    ? studioOrch!.agentRun
    : agentRun;
  const orchSkillBusy = studioOrchestrationActive
    ? studioOrch!.skillBusy
    : skillBusy;
  const orchAgentBusy = studioOrchestrationActive
    ? studioOrch!.agentBusy
    : agentBusy;

  const sessionResetKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const resetKey = sessionId ?? "";
    if (sessionResetKeyRef.current === resetKey) return;
    sessionResetKeyRef.current = resetKey;
    sessionEnsuredRef.current = false;
    if (!studioOrchestrationActive) {
      resetAgentRun();
      resetSkillRun();
    }
    setPrompt("");
    clearAttachmentState();
    setMentionedMasks([]);
    setSelectedSkillId(null);
    setDockSkillId(null);
  }, [sessionId, resetAgentRun, resetSkillRun, studioOrchestrationActive, setPrompt, clearAttachmentState]);

  useEffect(() => {
    if (!studioOrchestrationActive || !studioOrch) return;
    studioOrch.setInput({
      prompt,
      creationLane,
      activeSkillId,
      effectiveMode,
      focusEditActive: Boolean(focusEdit),
    });
  }, [
    studioOrchestrationActive,
    studioOrch,
    prompt,
    creationLane,
    activeSkillId,
    effectiveMode,
    focusEdit,
  ]);

  const orchestrationResetTick = studioOrch?.orchestrationResetTick ?? 0;
  const lastOrchestrationResetRef = useRef(0);
  useEffect(() => {
    if (!studioOrchestrationActive) return;
    if (orchestrationResetTick <= lastOrchestrationResetRef.current) return;
    lastOrchestrationResetRef.current = orchestrationResetTick;
    setPrompt("");
    clearAttachmentState();
    setMentionedMasks([]);
    setSelectedSkillId(null);
    setDockSkillId(null);
  }, [studioOrchestrationActive, orchestrationResetTick, setPrompt, clearAttachmentState]);

  const skillAwaitingConfirm = isSkillAwaitingConfirm(orchSkillRun);
  const skillInFlight = isSkillRunInFlight(orchSkillRun);
  const skillIdle =
    !orchSkillRun ||
    (["completed", "failed", "cancelled"] as SkillRunStatus[]).includes(
      orchSkillRun.status,
    );

  const agentAwaitingConfirm = isAgentAwaitingConfirm(orchAgentRun);
  const agentInFlight = isAgentRunInFlight(orchAgentRun);
  const submitAriaLabel = skillAwaitingConfirm
    ? "确认执行套餐"
    : agentAwaitingConfirm
      ? "确认执行"
      : creationLane === "agent"
        ? dramaOrchestrationActive
          ? "开始规划"
          : "提交 Agent"
        : activeSkillId === ECOMMERCE_SET_SKILL_ID
          ? "开始电商套图"
          : activeSkillId
            ? "开始套餐"
            : "开始生成";

  const effectiveCollapsed = isStudioDock ? false : collapsed;
  const promptNeedsExpandedDock = prompt.includes("\n") || prompt.length > 72;
  const dockShouldExpand =
    !isDock ||
    effectiveCollapsed ||
    dockFocused ||
    dockExpanded ||
    promptNeedsExpandedDock ||
    uploadPreviews.length > 0 ||
    selectedRefs.length > 0 ||
    mentionedAssetIds.length > 0 ||
    mentionedMasks.length > 0 ||
    canvasReferenceActive ||
    Boolean(focusEdit);
  const dockCompactLine =
    isDock &&
    (dockLineOnly
      ? !dockFocused &&
        !dockExpanded &&
        !promptNeedsExpandedDock &&
        uploadPreviews.length === 0 &&
        selectedRefs.length === 0 &&
        mentionedAssetIds.length === 0 &&
        mentionedMasks.length === 0 &&
        !canvasReferenceActive &&
        !focusEdit
      : !dockShouldExpand);
  const dockIconBtn =
    "flex shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200";
  const dockIconBtnClass = isDock
    ? `${dockIconBtn} size-8`
    : "flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10";
  const dockIconBtnClassSm = isDock
    ? `${dockIconBtn} size-8`
    : "flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10";
  const showStackUpload = effectiveMode !== "ecommerce";
  const showInlineUploadStack =
    showStackUpload && !dockCompactLine && creationLane !== "video";
  const smartMultiDegraded =
    videoReferenceMode === "smart-multi-frame" &&
    Boolean(
      capabilityDegradationMessage(
        resolveVideoSubmitModelId(modelId, models, videoAutoMeta),
      ),
    );

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

  useEffect(() => {
    if (initialPrompt) setPrompt(initialPrompt);
  }, [initialPrompt]);

  useEffect(() => {
    if (!isDock) return;
    if (dockLineOnly) {
      setDockExpanded(false);
      setDockFocused(false);
    } else if (initialDockExpanded) {
      setDockExpanded(true);
    }
  }, [dockLineOnly, initialDockExpanded, isDock]);

  useEffect(() => {
    if (!isDock) return;
    function onDockExpand(event: Event) {
      const detail = (event as CustomEvent<{ expanded?: boolean }>).detail;
      setDockExpanded(detail?.expanded ?? true);
    }
    window.addEventListener("aimarket:creation-dock-expand", onDockExpand);
    return () =>
      window.removeEventListener("aimarket:creation-dock-expand", onDockExpand);
  }, [isDock]);

  useEffect(() => {
    if (!isDock) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    const expand = () => {
      setDockFocused(true);
      setDockExpanded(true);
    };
    textarea.addEventListener("focus", expand);
    textarea.addEventListener("pointerdown", expand);
    return () => {
      textarea.removeEventListener("focus", expand);
      textarea.removeEventListener("pointerdown", expand);
    };
  }, [isDock]);

  useEffect(() => {
    if (!inspirationApply) return;
    setPrompt(inspirationApply.prompt);
    const inspirationSettings = {
      modelId: normalizeLaneModelId(inspirationApply.modelId),
      aspectRatio: coerceAspectRatio(inspirationApply.aspectRatio),
      resolution: inspirationApply.resolution,
    };
    if (isStudioDock) {
      setCreationLane(inspirationApply.creationLane, inspirationSettings);
      persistCreationLane("studio", inspirationApply.creationLane);
    } else {
      patchSettings(inspirationSettings);
    }
    const vars: Record<string, string> = {};
    for (const v of inspirationApply.variables ?? []) {
      vars[v.key] =
        inspirationApply.variableValues[v.key] ?? v.default;
    }
    setInspirationVars(vars);
    if (inspirationApply.referenceUrls.length > 0) {
      setUploadPreviews(
        inspirationApply.referenceUrls.map((url, i) => ({
          id: `insp-${inspirationApply.applyKey}-${i}`,
          url,
        })),
      );
      setAssetIds([]);
    }
  }, [inspirationApply?.applyKey]);

  useEffect(() => {
    if (!inspirationApply?.id || !Object.keys(inspirationVars).length) return;
    const t = setTimeout(() => {
      void renderInspiration(inspirationApply.id, inspirationVars)
        .then((data) => setPrompt(data.prompt))
        .catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [inspirationApply?.id, inspirationVars]);

  useEffect(() => {
    if (effectiveMode === "ecommerce") {
      setResolution("2k");
      setCount(4);
    }
  }, [mode]);

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
    const effectiveCount = effectiveMode === "ecommerce" ? 4 : count;
    const effectiveModel =
      effectiveMode === "ecommerce"
        ? "latest-v2-pro"
        : modelId === AUTO_MODEL_ID
          ? "omni-v2"
          : modelId;
    const effectiveRes = effectiveMode === "ecommerce" ? "2k" : resolution;
    estimatePoints(effectiveModel, effectiveCount, effectiveRes)
      .then(setEstimated)
      .catch(() => setEstimated(null));
  }, [user, modelId, count, resolution, mode]);

  useEffect(() => {
    if (!user || effectiveMode === "ecommerce") return;
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
    focusEdit?.points.length,
    effectiveMode,
  ]);

  const { candidates: videoPickCandidates, loading: videoPickCandidatesLoading } =
    useVideoPickCandidates({
      sessionId,
      creationLane,
      canvasItems,
      uploadPreviews,
      videoReferenceMode,
    });

  function applyVideoPickCandidate(
    pick: VideoPickCandidate,
    activeShotIndex = 0,
  ) {
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
  }

  useEffect(() => {
    if (!mentionItemRequest) return;
    const index = canvasItems.findIndex(
      (item) => item.id === mentionItemRequest.item.id,
    );
    const canvasItem = mentionItemRequest.item;

    if (creationLane === "video" && sessionId) {
      void (async () => {
        try {
          const pick = await resolveCanvasItemForVideoPick(
            canvasItem,
            index >= 0 ? index : 0,
            sessionId,
            registerAssetFromUrl,
          );
          if (!pick) return;
          applyVideoPickCandidate(pick);
          if (videoReferenceMode === "omni") {
            const mention = canvasItemToMentionItem(
              canvasItem,
              index >= 0 ? index : 0,
            );
            if (mention) {
              insertMention(mention, mentionItemRequest.promptSuffix ?? "");
            }
          }
          if (mentionItemRequest.maskSelection) {
            setMentionedMasks((prev) => [
              ...prev.filter((m) => m.id !== mentionItemRequest.maskSelection!.id),
              mentionItemRequest.maskSelection!,
            ]);
          }
        } catch (err) {
          onInteractionHint?.(
            err instanceof Error ? err.message : "引用到视频参考失败",
          );
        }
      })();
      return;
    }

    const mention = canvasItemToMentionItem(
      canvasItem,
      index >= 0 ? index : 0,
    );
    if (!mention) return;
    insertMention(mention, mentionItemRequest.promptSuffix ?? "");
    if (mentionItemRequest.maskSelection) {
      setMentionedMasks((prev) => [
        ...prev.filter((m) => m.id !== mentionItemRequest.maskSelection!.id),
        mentionItemRequest.maskSelection!,
      ]);
    }
    // 只响应外部请求 key，避免 canvasItems 刷新时重复插入同一 @ token。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentionItemRequest?.key]);

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
    // 采纳判定：提交内容命中某条润色候选 → 记入个性化风格画像
    if (polishCandidates.includes(prompt.trim())) {
      recordAcceptedPrompt(prompt.trim());
    }
    void handleSubmit();
  }

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
          confirmAgentRun: confirmAgentRunAction,
          startAgentRun: startAgentRun,
          confirmSkillRun: confirmSkillRunAction,
          startSkillRun: startSkillRun,
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
        confirmAgentRun: confirmAgentRunAction,
        startAgentRun: startAgentRun,
        confirmSkillRun: confirmSkillRunAction,
        startSkillRun: startSkillRun,
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

  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;

  useImperativeHandle(ref, () => ({
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

  const focusEditReady =
    Boolean(focusEdit?.points.length) &&
    (prompt.trim().length > 0 ||
      (focusEdit?.points ?? []).some(
        (p) => (p.chipPrompt ?? "").trim().length > 0,
      ));

  const agentIdle =
    !orchAgentRun ||
    (["completed", "failed", "cancelled"] as AgentRunStatus[]).includes(
      orchAgentRun.status,
    );

  const canSubmit =
    !readOnly &&
    !jobStreamStatus &&
    !orchAgentBusy &&
    !orchSkillBusy &&
    (skillAwaitingConfirm ||
      agentAwaitingConfirm ||
      (skillIdle &&
        agentIdle &&
        (focusEdit
          ? focusEditReady && !focusEdit.recognizing
          : activeSkillId || submitEcommerce
            ? prompt.trim().length >= 10 && Boolean(resolveProductAssetId())
            : prompt.trim().length > 0)));

  const imageLaneJobActive =
    Boolean(jobStreamStatus) &&
    jobStreamStatus !== "succeeded" &&
    jobStreamStatus !== "failed";

  const streamBusy =
    orchAgentBusy ||
    orchSkillBusy ||
    skillInFlight ||
    agentInFlight ||
    imageLaneJobActive;

  /** Studio 图片车道：进度以画布时间线为主，Dock 仅在失败时展示状态条 */
  const showDockJobStatusBar =
    Boolean(jobStreamStatus) &&
    !(isStudioDock && creationLane === "image" && imageLaneJobActive);

  const submitLoading =
    pending ||
    (isStudioDock && creationLane === "image" && imageLaneJobActive);

  const jobStatusSubtext =
    jobStreamStatus === "queued" && queueAhead != null
      ? queueAhead <= 0
        ? "即将开始处理"
        : `前方约 ${queueAhead} 个任务`
      : jobStreamStatus === "running" &&
          jobElapsedMs != null &&
          jobElapsedMs > 0
        ? `已用时 ${Math.max(1, Math.floor(jobElapsedMs / 1000))} 秒`
        : null;

  const {
    dockDragOver,
    handleDockDragEnter,
    handleDockDragLeave,
    handleDockDragOver,
    handleDockDrop,
  } = useCreationDockDrag({
    enabled: isDock,
    readOnly: Boolean(readOnly),
    onDropFiles: (files) => {
      uploadTargetRef.current = "general";
      void handleUploadRef.current(files);
    },
    onInvalidDrop: () =>
      onInteractionHint?.("仅支持拖拽 JPG / PNG / WebP 图片"),
  });

  const body = (
    <>
      {showDockJobStatusBar ? (
        <CreationPanelJobStatusBar
          jobStreamStatus={jobStreamStatus}
          streamBusy={streamBusy}
          jobStatusSubtext={jobStatusSubtext}
          pollingJobId={pollingJobId}
          onCancelJob={onCancelJob}
        />
      ) : null}

      {!effectiveCollapsed && inspirationApply ? (
        <CreationPanelInspirationVars
          inspirationApply={inspirationApply}
          inspirationVars={inspirationVars}
          onInspirationVarChange={(key, value) =>
            setInspirationVars((prev) => ({ ...prev, [key]: value }))
          }
        />
      ) : null}

      {showModeTabs && variant === "default" ? (
        <div className="mb-4 flex justify-center overflow-x-auto">
          <ModeTabs items={modeTabs} value={mode} onChange={setMode} />
        </div>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={uploadTarget === "general"}
        className="hidden"
        onChange={(e) => {
          /** FileList 与 input 联动；清空 value 前必须拷贝成普通数组。 */
          const picked = Array.from(e.currentTarget.files ?? []);
          e.target.value = "";
          void handleUpload(picked);
        }}
      />

      <div className={`relative ${isDock ? "" : "mt-3"}`}>
        <MentionPicker
          placement="above"
          canvasItems={canvasItems}
          uploadedAssets={mentionUploadedAssets}
          references={references}
          query={mentionQuery}
          open={mentionOpen}
          onSelect={insertMention}
          onClose={() => {
            setMentionOpen(false);
            setMentionQuery("");
          }}
        />
        <div
          className={
            isDock
              ? dockCompactLine
                ? "px-2.5 py-1.5 sm:px-3"
                : "px-3 pb-2.5 pt-2.5 sm:px-3.5"
              : ""
          }
          onFocusCapture={() => {
            if (!isDock) return;
            setDockFocused(true);
            setDockExpanded(true);
          }}
        >
          <div
            className={`relative flex min-w-0 gap-2 ${dockCompactLine ? "items-center" : "items-start"}`}
          >
            {dockCompactLine && creationLane !== "video" ? (
              <button
                type="button"
                onClick={() => openUpload("general")}
                className={dockIconBtnClassSm}
                aria-label="上传图片"
                title="上传图片"
              >
                {uploading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="size-3.5" />
                )}
              </button>
            ) : null}
            {isDock && creationLane === "video" ? (
              <VideoReferenceDockControl
                mode={videoReferenceMode}
                videoReferences={videoReferences}
                onVideoReferencesChange={setVideoReferences}
                smartMultiShots={smartMultiShots}
                onSmartMultiShotsChange={setSmartMultiShots}
                motionPrompt={firstLastMotionPrompt}
                onMotionPromptChange={setFirstLastMotionPrompt}
                onUpload={uploadVideoReference}
                pickCandidates={videoPickCandidates}
                pickCandidatesLoading={videoPickCandidatesLoading}
                onPickCandidate={applyVideoPickCandidate}
                disabled={readOnly || pending || streamBusy}
                uploading={videoUploading}
                smartMultiDegraded={smartMultiDegraded}
              />
            ) : null}
            {dockCompactLine ? (
              <div className="min-w-0 shrink-0 scale-90">
                <CreationLanePicker
                  value={creationLane}
                  onChange={handleCreationLaneChange}
                  agentAvailable={agentLaneAvailable}
                  disabled={readOnly || pending || streamBusy}
                />
              </div>
            ) : null}
            {showInlineUploadStack ? (
              <UploadPreviewStack
                items={uploadPreviews}
                uploading={uploading}
                onAdd={() => openUpload("general")}
                compact={isDock}
                onPreview={(index) => setUploadPreviewIndex(index)}
                onRemove={(id) => {
                  setUploadPreviews((prev) => prev.filter((p) => p.id !== id));
                  setAssetIds((prev) => prev.filter((a) => a !== id));
                }}
              />
            ) : null}
            <div
              className={`relative flex min-w-0 flex-1 gap-2 ${isDock && isStudioDock ? "pr-9 sm:pr-10" : ""}`}
            >
              {isDock && isStudioDock ? (
                <div
                  className="pointer-events-none mt-2 shrink-0 self-start text-zinc-500"
                  aria-hidden
                >
                  <Pencil className="size-3.5" strokeWidth={1.75} />
                </div>
              ) : null}
              <div
                className="relative min-w-0 flex-1"
                onClick={() => {
                  if (isDock) setDockExpanded(true);
                  textareaRef.current?.focus();
                }}
              >
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => {
                  const v = e.target.value;
                  setPrompt(v);
                  if (polishCandidates.length > 0) {
                    setPolishCandidates([]);
                    setPolishCandidateIndex(0);
                    setPolishHint(null);
                  }
                  syncMentionStateFromPrompt(v);
                  // 检测光标前的 @<query>，弹出/更新引用 popover
                  const caret = e.target.selectionStart ?? v.length;
                  const before = v.slice(0, caret);
                  const atIdx = before.lastIndexOf("@");
                  if (atIdx >= 0) {
                    const between = before.slice(atIdx + 1);
                    // @ 后仅空格仍展示列表；出现「空格+非空字符」视为已结束 mention 段
                    if (
                      !between.includes("\n") &&
                      !/\s\S/.test(between)
                    ) {
                      setMentionOpen(true);
                      setMentionQuery(between.trimStart());
                      return;
                    }
                  }
                  if (mentionOpen) {
                    setMentionOpen(false);
                    setMentionQuery("");
                  }
                }}
                placeholder={
                  isDock && !prompt.trim()
                    ? mode === "production"
                      ? rotatingPlaceholder
                        ? rotatingText
                        : PRODUCTION_DOCK_PLACEHOLDER
                      : creationLane === "image" && rotatingPlaceholder
                        ? rotatingText
                        : CREATION_LANE_PLACEHOLDERS[creationLane]
                    : effectiveMode === "ecommerce"
                      ? placeholders.ecommerce
                      : mode === "chat"
                        ? "输入想要的修改效果，@ 可引用画布上的图片"
                        : placeholders[mode]
                }
                rows={
                  effectiveCollapsed
                    ? 1
                    : effectiveMode === "ecommerce"
                      ? 3
                      : isDock
                        ? dockShouldExpand
                          ? 2
                          : 1
                        : 2
                }
                readOnly={readOnly}
                className={`w-full resize-none bg-transparent text-sm outline-none placeholder:text-zinc-600 ${
                  readOnly ? "cursor-not-allowed opacity-60" : ""
                } ${
                  isDock
                    ? `${dockShouldExpand ? "min-h-[52px] leading-7" : "min-h-[24px] leading-6 focus:min-h-[52px] focus:leading-7"} pr-9 text-zinc-100 transition-[min-height] duration-200`
                    : "rounded-2xl border border-white/10 bg-black/40 px-4 py-3 focus:border-purple-500/40"
                }`}
                onFocus={() => {
                  setDockFocused(true);
                  if (isDock) setDockExpanded(true);
                }}
                onPointerDown={() => {
                  if (isDock) setDockExpanded(true);
                }}
                onClick={() => {
                  if (isDock) setDockExpanded(true);
                }}
                onBlur={() => {
                  setDockFocused(false);
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    (submitOnEnter ? !e.shiftKey : e.metaKey || e.ctrlKey)
                  ) {
                    e.preventDefault();
                    handleSubmitAttempt();
                  }
                }}
              />
              {enablePolish ? (
                <button
                  type="button"
                  title={
                    polishBusy
                      ? "润色中…"
                      : polishHint
                        ? `已润色（${polishHint}）`
                        : prompt.trim()
                          ? "润色 Prompt"
                          : "输入描述后可一键润色"
                  }
                  disabled={!prompt.trim() || polishBusy}
                  onClick={() => {
                    const raw = prompt.trim();
                    if (!raw || polishBusy) return;
                    const polishApiMode = toApiCreationMode(effectiveMode);
                    const hasRefs =
                      referenceChips.length > 0 ||
                      assetIds.length > 0 ||
                      selectedRefs.length > 0 ||
                      mentionedAssetIds.length > 0;
                    // 意图识别：推断创作方向，驱动后端场景化润色
                    const intent = resolveIntent({
                      prompt: raw,
                      creationLane,
                      activeSkillId,
                      focusEditActive: Boolean(focusEdit?.points.length),
                      mentionedMasksCount: mentionedMasks.length,
                      submitVideo,
                      hasReferenceImages: hasRefs,
                      hasSelectedCanvasItem: Boolean(selectedCanvasItem),
                      dramaSkillActive: dramaOrchestrationActive,
                      studioOrchestrationActive,
                      skillsEnabled,
                      agentEnabled,
                      isDock,
                      submitEcommerce,
                    });
                    const sourceLabel = (
                      source: "template-mock" | "openai" | "dashscope",
                    ) => {
                      if (source === "dashscope") return "百炼";
                      if (source === "openai") return "OpenAI";
                      return "模板";
                    };
                    const composeHint = (
                      source: "template-mock" | "openai" | "dashscope",
                      directionLabel?: string,
                    ) =>
                      directionLabel
                        ? `${sourceLabel(source)} · ${directionLabel}`
                        : sourceLabel(source);
                    setPolishCandidates([]);
                    setPolishCandidateIndex(0);
                    if (!user || !getToken()) {
                      setPrompt(polishPrompt(polishApiMode, raw));
                      setPolishHint(composeHint("template-mock"));
                      return;
                    }
                    setPolishBusy(true);
                    void optimizePromptApi(raw, polishApiMode, {
                      context: {
                        modelId:
                          modelId === AUTO_MODEL_ID ? undefined : modelId,
                        aspectRatio,
                        hasReferenceImages: hasRefs,
                        creationLane,
                        intentSignal: intent.primarySignal,
                        intentConfidence: intent.confidence,
                        recentAccepted: readRecentAcceptedPrompts(3),
                      },
                    })
                      .then((res) => {
                        const candidates = [
                          res.prompt,
                          ...(res.variants ?? []),
                        ];
                        setPrompt(res.prompt);
                        setPolishCandidates(candidates);
                        setPolishCandidateIndex(0);
                        setPolishHint(
                          composeHint(res.source, res.directionLabel),
                        );
                      })
                      .catch(() => {
                        setPrompt(polishPrompt(polishApiMode, raw));
                        setPolishHint(composeHint("template-mock"));
                      })
                      .finally(() => setPolishBusy(false));
                  }}
                  className={`absolute bottom-1 right-1 rounded-lg p-1.5 transition ${
                    prompt.trim() && !polishBusy
                      ? "text-orange-400 hover:bg-white/10 hover:text-orange-300"
                      : "pointer-events-none text-zinc-600 opacity-70"
                  }`}
                  aria-label="润色描述"
                >
                  {polishBusy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Wand2 className="size-4" />
                  )}
                </button>
              ) : null}
              {enablePolish && polishCandidates.length > 1 && !polishBusy ? (
                <button
                  type="button"
                  title={`换一个（${polishCandidateIndex + 1}/${polishCandidates.length}）`}
                  onClick={() => {
                    const next =
                      (polishCandidateIndex + 1) % polishCandidates.length;
                    setPolishCandidateIndex(next);
                    setPrompt(polishCandidates[next]);
                  }}
                  className="absolute bottom-1 right-9 rounded-lg p-1.5 text-orange-400 transition hover:bg-white/10 hover:text-orange-300"
                  aria-label="换一个润色结果"
                >
                  <RefreshCw className="size-4" />
                </button>
              ) : null}
              </div>
            </div>
            {dockCompactLine ? (
              <Button
                  variant="primary"
                  className="size-8 shrink-0 rounded-full p-0"
                  onClick={handleSubmitAttempt}
                  disabled={readOnly || pending || streamBusy}
                  aria-label={submitAriaLabel}
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ArrowUp className="size-4" />
                  )}
                </Button>
            ) : null}
          </div>
        {!dockCompactLine && referenceChips.length > 0 ? (
          <ReferenceChips
            chips={referenceChips}
            onRemove={handleRemoveReferenceChip}
          />
        ) : null}
        {!dockCompactLine && mentionedMasks.length > 0 ? (
          <p className="mt-1 text-xs text-amber-300">
            已圈选 {mentionedMasks.length} 个局部区域，将随提示词一起提交
          </p>
        ) : null}
        {!dockCompactLine && focusEdit ? (
          <FocusEditChips
            points={focusEdit.points}
            intent={focusEdit.intent}
            cropSize={focusEdit.cropSize}
            recognizing={focusEdit.recognizing}
            sessionId={sessionId}
            onIntentChange={focusEdit.onIntentChange}
            onRemove={focusEdit.onRemovePoint}
            onEdit={focusEdit.onEditPoint}
            onChipPromptChange={focusEdit.onChipPromptChange}
            onReplaceImage={focusEdit.onReplaceImage}
            onClearAll={focusEdit.onClearAll}
            onCropSizeChange={focusEdit.onCropSizeChange}
            onCancel={focusEdit.onCancel}
          />
        ) : null}
        {!dockCompactLine && assetIds.length > 0 && !(isDock && isStudioDock) ? (
          <p className="mt-1 text-xs text-zinc-500">
            已上传 {assetIds.length} 张附件
          </p>
        ) : null}
        {!dockCompactLine && routeHint && !(isDock && isStudioDock) ? (
          <p className="mt-1 text-xs text-orange-400/80">路由：{routeHint}</p>
        ) : null}

        {skillsEnabled && !isDock && !effectiveCollapsed && !dockCompactLine && !focusEdit ? (
          <SkillPackagePicker
            skills={skillPackages}
            selectedId={selectedSkillId}
            disabled={
              skillInFlight || orchSkillBusy || Boolean(orchSkillRun && !skillIdle)
            }
            onSelect={setSelectedSkillId}
          />
        ) : null}

        {skillsEnabled &&
        activeSkillId &&
        !effectiveCollapsed &&
        !dockCompactLine &&
        !isStudioDock ? (
          <SkillRunPanel
            skill={selectedSkill}
            run={skillRun}
            confirmBusy={skillBusy || pending}
            onConfirm={() => void handleSubmit()}
            onCancelRun={() => void cancelSkillRunAction()}
          />
        ) : null}

        {agentEnabled &&
        !activeSkillId &&
        (!isDock || creationLane === "agent") &&
        !effectiveCollapsed &&
        !dockCompactLine &&
        !isStudioDock &&
        !homeDirectSubmit ? (
          <AgentRunPanel
            prompt={prompt}
            mode={effectiveMode}
            enabled={agentEnabled && !focusEdit}
            run={agentRun}
            confirmBusy={agentBusy || pending}
            onConfirm={() => void handleSubmit()}
            onCancelRun={() => void cancelAgentRunAction()}
          />
        ) : null}

          {dockCompactLine ? null : effectiveCollapsed ? (
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                {!showStackUpload ? (
                  <button
                    type="button"
                    onClick={() => openUpload("general")}
                    className={dockIconBtnClassSm}
                    aria-label="上传图片"
                    title="上传图片"
                  >
                    {uploading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="size-3.5" />
                    )}
                  </button>
                ) : null}
                {sessionId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMentionQuery("");
                      setMentionOpen(true);
                      textareaRef.current?.focus();
                    }}
                    className={dockIconBtnClassSm}
                    aria-label="引用画布图片"
                    title="@ 引用画布图片"
                  >
                    <AtSign className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  variant="primary"
                  className="size-9 shrink-0 rounded-full p-0"
                  onClick={handleSubmitAttempt}
                  disabled={readOnly || pending || streamBusy}
                  aria-label={submitAriaLabel}
                >
                  {pending ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <ArrowUp className="size-5" />
                  )}
                </Button>
              </div>
            </div>
          ) : (
          <div
            className={`flex items-center justify-between gap-2 ${isDock ? "mt-3" : "mt-3"} ${
              isDock && isStudioDock
                ? "-mx-1 border-t border-white/[0.06] px-1 pt-2.5 sm:-mx-1.5 sm:px-1.5"
                : ""
            }`}
          >
        <div
          className={
            isDock
              ? "flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              : "flex flex-wrap items-center gap-2"
          }
        >
          {!showStackUpload ? (
            <button
              type="button"
              onClick={() => openUpload("general")}
              className={dockIconBtnClass}
              aria-label="上传图片"
              title="上传图片"
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImagePlus className="size-4" />
              )}
            </button>
          ) : null}
          {sessionId ? (
            <button
              type="button"
              onClick={() => {
                setMentionQuery("");
                setMentionOpen(true);
                textareaRef.current?.focus();
              }}
              className={dockIconBtnClass}
              aria-label="引用画布图片"
              title="@ 引用画布图片"
            >
              <AtSign className="size-4" />
            </button>
          ) : null}
          {enablePolish && (assetIds.length > 0 || uploadPreviews.length > 0) ? (
            <button
              type="button"
              title="根据图片反推 Prompt（图生文）"
              disabled={reversing || streamBusy}
              onClick={() => void handlePromptReverse()}
              className={`${dockIconBtnClass} disabled:opacity-50`}
              aria-label="图生文"
            >
              {reversing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
            </button>
          ) : null}
          {isDock ? (
            <CreationDockToolbar
              creationLane={creationLane}
              onCreationLaneChange={handleCreationLaneChange}
              agentAvailable={agentLaneAvailable}
              disabled={readOnly || pending || streamBusy}
              outputPrefMode={outputPrefMode}
              onOutputPrefModeChange={handleOutputPrefModeChange}
              dockSkillOptions={[]}
              dockSkillId={null}
              onDockSkillChange={() => {}}
              models={models}
              modelId={modelId}
              onModelChange={setModelId}
              count={count}
              onCountChange={setCount}
              resolution={resolution}
              aspectRatio={aspectRatio}
              onResolutionChange={setResolution}
              onAspectRatioChange={setAspectRatio}
              videoReferenceMode={videoReferenceMode}
              onVideoReferenceModeChange={handleVideoReferenceModeChange}
              videoDurationSec={videoDurationSec}
              onVideoDurationSecChange={setVideoDurationSec}
              videoResolution={videoResolution}
              onVideoResolutionChange={setVideoResolution}
              smartMultiShotCount={smartMultiShots.length}
              videoAutoLabel={videoAutoPickerLabel(
                modelId,
                models,
                videoAutoMeta,
              )}
              videoRoutes={videoRoutes}
            />
          ) : effectiveMode !== "ecommerce" ? (
            <>
              <ModelPicker
                models={models}
                value={modelId}
                onChange={setModelId}
                videoRoutes={isVideoModel ? videoRoutes : undefined}
              />
              <CountPicker value={count} onChange={setCount} max={4} />
              <GenerationSettingsPopover
                mode={mode}
                resolution={resolution}
                aspectRatio={aspectRatio}
                onResolutionChange={setResolution}
                onAspectRatioChange={setAspectRatio}
                videoMode={isVideoModel}
              />
            </>
          ) : (
            <>
              <CreationPanelPill>最新图片 V2 Pro · 4 张 · 2K</CreationPanelPill>
              <CreationPanelPill>
                智能 · {resolution.toUpperCase()} · 1:1 套图
              </CreationPanelPill>
            </>
          )}
        </div>
        <div className={`flex shrink-0 items-center ${isDock ? "gap-1.5" : "gap-2"}`}>
          {estimated !== null && user && getToken() ? (
            <span
              className="inline-flex items-center gap-1 text-xs text-pink-400"
              title="本次消耗积分"
            >
              <Sparkles className="size-3.5 fill-pink-400/30" />
              {estimated}
            </span>
          ) : null}
          <Button
            variant="primary"
            className={`size-9 shrink-0 rounded-full p-0 sm:size-10 ${
              isDock && isStudioDock
                ? "shadow-[0_0_22px_rgba(249,115,22,0.35)] transition-shadow hover:shadow-[0_0_28px_rgba(249,115,22,0.45)]"
                : ""
            }`}
            onClick={handleSubmitAttempt}
            disabled={readOnly || pending || streamBusy}
            aria-label={submitAriaLabel}
          >
            {submitLoading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ArrowUp className="size-5" />
            )}
          </Button>
        </div>
          </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <CreationPanelView
      isDock={isDock}
      compact={compact}
      navigating={navigating}
      uploadPreviewIndex={uploadPreviewIndex}
      uploadPreviews={uploadPreviews}
      onUploadPreviewClose={() => setUploadPreviewIndex(null)}
      onDockModeChange={onDockModeChange}
      dockDragOver={dockDragOver}
      onDockDragEnter={handleDockDragEnter}
      onDockDragLeave={handleDockDragLeave}
      onDockDragOver={handleDockDragOver}
      onDockDrop={handleDockDrop}
    >
      {body}
    </CreationPanelView>
  );
}
