"use client";

import type { ReactNode, Ref } from "react";
import type { CreationPanelHandle, CreationPanelProps } from "@/components/creation-panel-types";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { type CreationMode } from "@aimarket/ui";
import { useAuth } from "@/lib/auth-context";
import { type CanvasMaskSelection } from "@/lib/canvas-tools";
import type { PendingAsset } from "@/lib/pending-assets";
import { useRotatingPlaceholder } from "@/hooks/use-rotating-placeholder";
import { CreationPanelBody } from "@/components/creation-panel-body";
import { buildCreationPanelBodyProps } from "@/components/creation-panel-body-props";
import { CreationPanelView } from "@/components/creation-panel-view";
import { useCreationDockDrag } from "@/hooks/use-creation-dock-drag";
import { useCreationPanelAssets } from "@/hooks/use-creation-panel-assets";
import { useCreationPanelSubmit } from "@/hooks/use-creation-panel-submit";
import { useCreationPanelPolish } from "@/hooks/use-creation-panel-polish";
import { useCreationPanelVideo } from "@/hooks/use-creation-panel-video";
import { useCreationPanelDock } from "@/hooks/use-creation-panel-dock";
import { useCreationPanelOrchestration } from "@/hooks/use-creation-panel-orchestration";
import {
  useCreationPanelDataEffects,
  useCreationPanelModels,
} from "@/hooks/use-creation-panel-catalog";
import { AUTO_MODEL_ID } from "@/components/model-picker";
import { normalizeDockSkillId } from "@/components/creation-dock-controls";
import { type CreationDockScope, type CreationLane } from "@/lib/creation-dock-prefs";
import { useCreationLaneDrafts } from "@/hooks/use-creation-lane-drafts";
import { useCreationPanelMention } from "@/hooks/use-creation-panel-mention";

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
  const isStudioDock = variant === "studio-dock";
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
  const { models, videoAutoMeta, videoRoutes } = useCreationPanelModels(user);
  const [inspirationVars, setInspirationVars] = useState<
    Record<string, string>
  >({});
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
  const effectiveMode: CreationMode = mode;
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
  const video = useCreationPanelVideo({
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
  });
  const {
    videoReferences,
    setVideoReferences,
    videoUploading,
    smartMultiShots,
    setSmartMultiShots,
    firstLastMotionPrompt,
    setFirstLastMotionPrompt,
    handleVideoReferenceModeChange,
    uploadVideoReference,
    applyVideoPickCandidate,
    smartMultiDegraded,
  } = video;
  const selectedModel =
    modelId === AUTO_MODEL_ID ? undefined : models.find((m) => m.id === modelId);
  const isVideoModel = selectedModel?.type === "video";
  const [dockSkillId, setDockSkillId] = useState<string | null>(null);
  const sessionEnsuredRef = useRef(false);
  const normalizedDockSkillId = normalizeDockSkillId(dockSkillId);
  const activeSkillId = isDock ? normalizedDockSkillId : selectedSkillId;

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
    estimated,
    routeHint,
    setRouteHint,
    references,
    setReferences,
  } = useCreationPanelDataEffects({
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
    focusEditPointCount: focusEdit?.points.length ?? 0,
  });

  const {
    setDockExpanded,
    setDockFocused,
    handleCreationLaneChange,
    handleOutputPrefModeChange,
    handleDockSkillChange,
    effectiveCollapsed,
    dockShouldExpand,
    dockCompactLine,
    dockIconBtnClass,
    dockIconBtnClassSm,
    showStackUpload,
    showInlineUploadStack,
  } = useCreationPanelDock({
    isDock,
    isStudioDock,
    dockLineOnly,
    initialDockExpanded,
    collapsed,
    effectiveMode,
    creationLane,
    setCreationLane,
    outputPrefMode,
    setOutputPrefMode,
    modelId,
    setModelId,
    setAspectRatio,
    models,
    prompt,
    setPrompt,
    textareaRef,
    onInteractionHint,
    buildReferenceSources,
    setDockSkillId,
    setSelectedSkillId,
    uploadPreviews,
    selectedRefs,
    mentionedAssetIds,
    mentionedMasks,
    canvasReferenceActive,
    focusEdit,
    creationDockScope,
    inspirationApply,
    patchSettings,
    setUploadPreviews,
    setAssetIds,
    inspirationVars,
    setInspirationVars,
  });

  const {
    skillPackages,
    skillRun,
    skillBusy,
    confirmSkillRunAction,
    cancelSkillRunAction,
    agentRun,
    agentBusy,
    confirmAgentRunAction,
    cancelAgentRunAction,
    startAgentRun,
    startSkillRun,
    selectedSkill,
    orchSkillRun,
    orchAgentRun,
    orchSkillBusy,
    orchAgentBusy,
    skillAwaitingConfirm,
    skillInFlight,
    skillIdle,
    agentAwaitingConfirm,
    agentInFlight,
    agentIdle,
    submitAriaLabel,
  } = useCreationPanelOrchestration({
    sessionId,
    effectiveMode,
    skillsEnabled,
    agentEnabled,
    creationLane,
    activeSkillId,
    selectedSkillId,
    prompt,
    setPrompt,
    focusEditActive,
    sessionEnsuredRef,
    clearAttachmentState,
    setMentionedMasks,
    setSelectedSkillId,
    setDockSkillId,
    refreshUser,
    onJobStarted,
    onAgentRunComplete,
  });

  const {
    polishBusy,
    polishHint,
    polishCandidates,
    polishCandidateIndex,
    handlePolish,
    cyclePolishCandidate,
    resetPolish,
  } = useCreationPanelPolish({
    prompt,
    setPrompt,
    user,
    effectiveMode,
    creationLane,
    activeSkillId,
    focusEdit,
    mentionedMasks,
    submitVideo,
    referenceChips,
    assetIds,
    selectedRefs,
    mentionedAssetIds,
    selectedCanvasItem,
    skillsEnabled,
    agentEnabled,
    isDock,
    modelId,
    aspectRatio,
  });

  const { videoPickCandidates, videoPickCandidatesLoading } =
    useCreationPanelMention({
      sessionId,
      creationLane,
      canvasItems,
      uploadPreviews,
      videoReferenceMode,
      mentionItemRequest,
      insertMention,
      applyVideoPickCandidate,
      setMentionedMasks,
      onInteractionHint,
    });

  const focusEditReady =
    Boolean(focusEdit?.points.length) &&
    (prompt.trim().length > 0 ||
      (focusEdit?.points ?? []).some(
        (p) => (p.chipPrompt ?? "").trim().length > 0,
      ));

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
          : activeSkillId
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

  const {
    pending,
    navigating,
    handleSubmit,
    handleSubmitAttempt,
  } = useCreationPanelSubmit({
    panelRef: ref,
    readOnly,
    streamBusy,
    prompt,
    effectiveMode,
    selectedSkillId,
    polishCandidates,
    onInteractionHint,
    textareaRef,
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
    orchAgentRun,
    orchSkillRun,
    confirmAgentRun: confirmAgentRunAction,
    startAgentRun,
    confirmSkillRun: confirmSkillRunAction,
    startSkillRun,
    clearAttachmentState,
    setMentionedMasks,
    setDockSkillId,
    setReferences,
    skillsEnabled,
    agentEnabled,
    isDock,
    submitVideo,
    setRouteHint,
    setProductAssetId,
    setReferenceAssetId,
    brand,
    platform,
    market,
    language,
    designer,
    autoSubmitOnce,
  });

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
      <CreationPanelBody
        {...buildCreationPanelBodyProps({
    showDockJobStatusBar,
    jobStreamStatus,
    streamBusy,
    jobStatusSubtext,
    pollingJobId,
    onCancelJob,
    effectiveCollapsed,
    inspirationApply,
    inspirationVars,
    setInspirationVars,
    showModeTabs,
    variant,
    mode,
    setMode,
    fileRef,
    uploadTarget,
    handleUpload,
    isDock,
    dockCompactLine,
    creationLane,
    canvasItems,
    mentionUploadedAssets,
    references,
    mentionQuery,
    mentionOpen,
    insertMention,
    setMentionOpen,
    setMentionQuery,
    setDockFocused,
    setDockExpanded,
    openUpload,
    dockIconBtnClassSm,
    uploading,
    videoReferenceMode,
    videoReferences,
    setVideoReferences,
    smartMultiShots,
    setSmartMultiShots,
    firstLastMotionPrompt,
    setFirstLastMotionPrompt,
    uploadVideoReference,
    videoPickCandidates,
    videoPickCandidatesLoading,
    applyVideoPickCandidate,
    readOnly,
    pending,
    videoUploading,
    smartMultiDegraded,
    agentLaneAvailable,
    handleCreationLaneChange,
    showInlineUploadStack,
    uploadPreviews,
    setUploadPreviewIndex,
    setUploadPreviews,
    setAssetIds,
    isStudioDock,
    textareaRef,
    prompt,
    setPrompt,
    polishCandidates,
    resetPolish,
    syncMentionStateFromPrompt,
    rotatingPlaceholder,
    rotatingText,
    effectiveMode,
    dockShouldExpand,
    submitOnEnter,
    handleSubmitAttempt,
    enablePolish,
    polishBusy,
    polishHint,
    handlePolish,
    cyclePolishCandidate,
    polishCandidateIndex,
    referenceChips,
    handleRemoveReferenceChip,
    mentionedMasks,
    sessionId,
    assetIds,
    routeHint,
    skillsEnabled,
    skillPackages,
    selectedSkillId,
    skillInFlight,
    orchSkillBusy,
    orchSkillRun,
    skillIdle,
    setSelectedSkillId,
    activeSkillId,
    selectedSkill,
    skillRun,
    skillBusy,
    handleSubmit,
    cancelSkillRunAction,
    agentEnabled,
    homeDirectSubmit,
    agentRun,
    agentBusy,
    cancelAgentRunAction,
    showStackUpload,
    dockIconBtnClass,
    reversing,
    handlePromptReverse,
    outputPrefMode,
    handleOutputPrefModeChange,
    models,
    modelId,
    setModelId,
    count,
    setCount,
    resolution,
    aspectRatio,
    setResolution,
    setAspectRatio,
    handleVideoReferenceModeChange,
    videoDurationSec,
    setVideoDurationSec,
    videoResolution,
    setVideoResolution,
    videoAutoMeta,
    videoRoutes,
    isVideoModel,
    estimated,
    user,
    submitAriaLabel,
    submitLoading,
          focusEdit,
        })}
      />
    </CreationPanelView>
  );
}
