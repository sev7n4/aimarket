"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp,
  AtSign,
  ImagePlus,
  Loader2,
  Pencil,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  Button,
  GlassPanel,
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
  submitEcommerceGenerate,
  submitGeneration,
  submitVideoGeneration,
  suggestModel,
  uploadAsset,
  registerAssetFromUrl,
  trackEvent,
  optimizePromptApi,
  reversePromptFromImage,
  renderInspiration,
} from "@/lib/api-client";
import { polishPrompt } from "@/lib/prompt-polish";
import { jobStatusLabel } from "@/lib/job-stream";
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
  type MentionItem,
} from "@/components/mention-picker";
import {
  pendingLineageToApiFields,
  resolveSubmitBatchLineage,
  type CanvasItem,
  type CanvasMaskSelection,
  type PendingBatchLineage,
} from "@/lib/canvas-tools";
import type { SessionReference } from "@/lib/types";
import { useRotatingPlaceholder } from "@/hooks/use-rotating-placeholder";
import { randomUUID } from "@/lib/uuid";
import { clientNavigate } from "@/lib/client-navigate";
import { storePendingAssets, type PendingAsset } from "@/lib/pending-assets";
import { HomeGenerationPreview } from "@/components/home-generation-preview";
import { CanvasLightbox } from "@/components/canvas-lightbox";
import {
  UploadPreviewStack,
  type UploadPreviewItem,
} from "@/components/upload-preview-stack";

const DOCK_UPLOAD_IMAGE_TYPES = /^image\/(jpeg|png|webp)$/i;

function imageFilesFromDataTransfer(dt: DataTransfer): File[] {
  return Array.from(dt.files ?? []).filter((f) =>
    DOCK_UPLOAD_IMAGE_TYPES.test(f.type),
  );
}

function dataTransferHasFiles(dt: DataTransfer): boolean {
  return dt.types.includes("Files") || dt.files.length > 0;
}
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
import { StudioDockFocusButton } from "@/components/studio-dock-controls";
import { DramaCoach } from "@/components/drama-coach";
import { DramaProductionDockParams } from "@/components/drama-production-dock-params";
import {
  CreationDockToolbar,
  CreationLanePicker,
  SkillDockPicker,
  buildDockSkillOptions,
  DRAMA_SKILL_ID,
  ECOMMERCE_SET_SKILL_ID,
  normalizeDockSkillId,
} from "@/components/creation-dock-controls";
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
  videoRefsToMentionCandidates,
} from "@/lib/video-mention";
import { useCreationLaneDrafts } from "@/hooks/use-creation-lane-drafts";
import { useVideoPickCandidates } from "@/hooks/use-video-pick-candidates";
import {
  canAutoBindCanvasItem,
  mergeReferenceSources,
} from "@/lib/canvas-reference-bind";
import {
  resolveCanvasItemForVideoPick,
  routePickToVideoSlots,
  type VideoPickCandidate,
} from "@/lib/canvas-video-reference-bind";
import {
  ReferenceChips,
  type ReferenceChipItem,
} from "@/components/reference-chips";
import {
  extractMentionLabelsFromPrompt,
  filterAssetIdsByPromptLabels,
  filterRefsByPromptLabels,
  removeMentionTokenFromPrompt,
} from "@/lib/mention-sync";
import {
  buildDirectSubmitContext,
  buildOrchestrationDispatchContext,
  hasReferenceImages,
  normalizeReferenceOutputIds,
  resolveCreationSubmitPath,
  shouldOrchestrationHandleSubmit,
} from "@/lib/creation-lane-submit";
import {
  isAgentAwaitingConfirm,
  isAgentRunInFlight,
  isSkillAwaitingConfirm,
  isSkillRunInFlight,
  submitAgentOrchestration,
  submitSkillOrchestration,
} from "@/lib/creation-orchestration-submit";
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

interface CreationPanelProps {
  initialMode?: CreationMode;
  initialPrompt?: string;
  compact?: boolean;
  variant?: "default" | "dock" | "studio-dock";
  mode?: CreationMode;
  onModeChange?: (mode: CreationMode) => void;
  showModeTabs?: boolean;
  sessionId?: string;
  onAuthRequired?: (hint?: string) => void;
  /** 首页：空提交等轻提示（不触发登录） */
  onInteractionHint?: (message: string) => void;
  /** 首页 dock：Enter 直接提交（Shift+Enter 换行） */
  submitOnEnter?: boolean;
  onJobStarted?: (jobId: string, lineage?: PendingBatchLineage) => void;
  /** Studio 父级 SSE/轮询推送的状态（对标椒图进度感） */
  jobStreamStatus?: string | null;
  /** 当前正在运行的任务ID，用于取消任务 */
  pollingJobId?: string | null;
  /** 取消任务的回调 */
  onCancelJob?: () => void;
  jobElapsedMs?: number;
  queueAhead?: number | null;
  navigateOnSubmit?: boolean;
  /** 首页：左侧虚线上传位 */
  leadingUpload?: boolean;
  /** 首页：Prompt 润色按钮 */
  enablePolish?: boolean;
  /** 登录后首页直接提交并跳转 Studio */
  homeDirectSubmit?: boolean;
  /** 轮播「试试输入：…」占位（对标椒图） */
  rotatingPlaceholder?: boolean;
  /** 团队空间只读：禁止在本会话生成 */
  readOnly?: boolean;
  /** Studio 恢复未登录时上传的附件（含预览 URL） */
  restoredAssets?: PendingAsset[];
  /** Studio 灵感同款灌入 */
  inspirationApply?: StudioInspirationApply | null;
  /** 输入区左侧"灵感"圆按钮点击回调（首页用来展开扇形面板） */
  onInspirationClick?: () => void;
  /** 加载过灵感套图后，灵感按钮显示缩略图 */
  inspirationCoverUrl?: string;
  /** 灵感面板当前是否展开（控制按钮高亮态） */
  inspirationActive?: boolean;
  /** 受控 prompt（Studio 工作台与 CreationPanel 同步） */
  prompt?: string;
  /** prompt 变化回调 */
  onPromptChange?: (prompt: string) => void;
  /**
   * 折叠态（用于 Studio 「最大化画布」）：仅保留 textarea + 灵感/上传 + 发送按钮，
   * 隐藏模型/数量/分辨率/Agent 计划预览等高级控件，把 dock 高度收缩到 ~56px。
   */
  collapsed?: boolean;
  /** 首页原位：默认展开创作台（多行 + 工具栏） */
  initialDockExpanded?: boolean;
  /** 首页滚出视口后：强制单行收缩（点击/聚焦可再展开） */
  dockLineOnly?: boolean;
  /** Studio Dock 三态（studio-dock variant，专注画布按钮） */
  onDockModeChange?: (mode: StudioDockMode) => void;
  /**
   * 画布上的图片（用于 @ 上下文引用候选项）。
   * 仿 Cursor 的 @ 体验，工作台输入框 @ 后弹 popover 列出画布所有图片，
   * 选中后插入 chip token 并把对应 assetId/outputId 一同提交。
   */
  canvasItems?: CanvasItem[];
  /**
   * 画布工具浮层触发的 @ 当前图请求。
   * key 每次递增，避免同一张图连续 @ 时被 React 依赖去重。
   */
  mentionItemRequest?: {
    key: number;
    item: CanvasItem;
    promptSuffix?: string;
    maskSelection?: CanvasMaskSelection;
  } | null;
  /** 焦点编辑：Chip 列表与 intent，提交时走 focus-edit/run */
  focusEdit?: {
    points: FocusPointChip[];
    intent: FocusEditIntent;
    cropSize?: number;
    recognizing?: boolean;
    onIntentChange: (intent: FocusEditIntent) => void;
    onRemovePoint: (pointId: string) => void;
    onEditPoint?: (pointId: string, newName: string) => void;
    onChipPromptChange?: (pointId: string, prompt: string) => void;
    onReplaceImage?: (pointId: string, assetId: string, url: string) => void;
    onClearAll?: () => void;
    onCropSizeChange?: (size: number) => void;
    onCancel: () => void;
  } | null;
  onFocusEditSubmit?: (args: {
    prompt: string;
    intent: FocusEditIntent;
    points: FocusPointChip[];
    item: CanvasItem;
  }) => Promise<string>;
  /** 上传完成后把图片添加到画布素材区 */
  onUploadToCanvas?: (assetId: string, url: string, thumbUrl?: string) => void;
  /** Studio：当前选中的画布项，图片/视频车道自动作参考 */
  selectedCanvasItem?: CanvasItem | null;
  /** Studio：取消画布点选参考（chip × 或等价操作） */
  onClearCanvasSelection?: () => void;
  /** Studio：走 Agent Run 编排（/agent/runs） */
  agentOrchestration?: boolean;
  /** Studio：展示长 Skill 套餐（/agent/skills） */
  agentSkills?: boolean;
  /** Agent Run 结束（成功/失败/取消）后回调 */
  onAgentRunComplete?: () => void;
}

export function CreationPanel({
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
}: CreationPanelProps) {
  const studioOrch = useStudioOrchestrationOptional();
  const isStudioDock = variant === "studio-dock";
  const studioOrchestrationActive = isStudioDock && studioOrch != null;
  const shouldNavigateOnSubmit =
    navigateOnSubmit ?? (!sessionId && !homeDirectSubmit);
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<"product" | "reference" | "general">("general");
  const [uploadTarget, setUploadTarget] = useState<
    "product" | "reference" | "general"
  >("general");

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
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [productAssetId, setProductAssetId] = useState<string | null>(null);
  const [referenceAssetId, setReferenceAssetId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dockDragOver, setDockDragOver] = useState(false);
  const dockDragDepthRef = useRef(0);
  const [references, setReferences] = useState<SessionReference[]>([]);
  const [selectedRefs, setSelectedRefs] = useState<SessionReference[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  /** @ 后的查询字符串（从光标往前找 @ 截取） */
  const [mentionQuery, setMentionQuery] = useState("");
  /** 已通过 @ 引用的 canvas-asset 项，提交时把 assetId 合并到请求 */
  const [mentionedAssetIds, setMentionedAssetIds] = useState<string[]>([]);
  const [mentionedAssetPreviews, setMentionedAssetPreviews] = useState<
    Array<UploadPreviewItem & { label?: string }>
  >([]);
  const [mentionedMasks, setMentionedMasks] = useState<CanvasMaskSelection[]>(
    [],
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [dockExpanded, setDockExpanded] = useState(
    () => initialDockExpanded && !dockLineOnly,
  );
  const [dockFocused, setDockFocused] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [uploadPreviews, setUploadPreviews] = useState<UploadPreviewItem[]>([]);
  const [uploadPreviewIndex, setUploadPreviewIndex] = useState<number | null>(null);
  const [reversing, setReversing] = useState(false);

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
  const isProductionStudio = isStudioDock && mode === "production";
  const agentEnabled =
    agentOrchestration &&
    Boolean(sessionId) &&
    isDock &&
    !readOnly;
  const agentLaneAvailable = agentOrchestration && isDock;
  const creationDockScope: CreationDockScope = isStudioDock ? "studio" : "home";

  const skillsEnabled = agentSkills && agentEnabled;

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
  const submitEcommerce = !isDock && effectiveMode === "ecommerce";
  const submitVideo = isDock ? creationLane === "video" : isVideoModel;

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
        setAssetIds([]);
        setUploadPreviews([]);
        setProductAssetId(null);
        setReferenceAssetId(null);
        setSelectedRefs([]);
        setMentionedAssetIds([]);
        setMentionedAssetPreviews([]);
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

  const dockSkillOptions = useMemo(
    () =>
      buildDockSkillOptions(
        studioOrchestrationActive ? studioOrch!.skillPackages : skillPackages,
        true,
      ),
    [studioOrchestrationActive, studioOrch, skillPackages],
  );

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
    if (!requireAuth("登录后即可上传参考素材")) {
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

  function buildReferenceSources() {
    return mergeReferenceSources(
      {
        assetIds,
        mentionedAssetIds,
        selectedRefIds: selectedRefs.map((r) => r.id),
      },
      selectedCanvasItem,
      creationLane,
      Boolean(focusEdit?.points.length),
    );
  }

  function resolveAssetMentionLabel(assetId: string): string | undefined {
    const preview = mentionedAssetPreviews.find((p) => p.id === assetId);
    if (preview?.label) return preview.label;
    const canvasIdx = canvasItems.findIndex((item) => item.assetId === assetId);
    if (canvasIdx >= 0) {
      return canvasItems[canvasIdx]?.label ?? `图${canvasIdx + 1}`;
    }
    const uploadIdx = uploadPreviews.findIndex((p) => p.id === assetId);
    if (uploadIdx >= 0) {
      return `上传图${uploadIdx + 1}`;
    }
    const videoRef = videoReferences.find((r) => r.assetId === assetId);
    if (videoRef?.label) return videoRef.label;
    return undefined;
  }

  function syncMentionStateFromPrompt(nextPrompt: string) {
    const labels = extractMentionLabelsFromPrompt(nextPrompt);
    setSelectedRefs((prev) => filterRefsByPromptLabels(prev, labels));
    const labelByAssetId = new Map<string, string>();
    for (const assetId of mentionedAssetIds) {
      const label = resolveAssetMentionLabel(assetId);
      if (label) labelByAssetId.set(assetId, label);
    }
    setMentionedAssetIds((prev) =>
      filterAssetIdsByPromptLabels(prev, labelByAssetId, labels),
    );
    setMentionedAssetPreviews((prev) =>
      prev.filter((preview) => {
        const label = preview.label ?? resolveAssetMentionLabel(preview.id);
        return label != null && labels.includes(label);
      }),
    );
  }

  const canvasReferenceActive =
    canAutoBindCanvasItem(
      selectedCanvasItem,
      creationLane,
      Boolean(focusEdit?.points.length),
    ) && creationLane !== "video";

  const referenceChips = useMemo((): ReferenceChipItem[] => {
    const chips: ReferenceChipItem[] = [];
    if (canvasReferenceActive && selectedCanvasItem) {
      chips.push({
        id: selectedCanvasItem.id,
        variant: "canvas",
        label: selectedCanvasItem.label ?? "图片",
        url: selectedCanvasItem.url,
      });
    }
    for (const ref of selectedRefs) {
      chips.push({
        id: ref.id,
        variant: "mention-output",
        label: ref.label,
        url: ref.url,
      });
    }
    for (const assetId of mentionedAssetIds) {
      const preview = mentionedAssetPreviews.find((p) => p.id === assetId);
      chips.push({
        id: assetId,
        variant: "mention-asset",
        label: preview?.label ?? resolveAssetMentionLabel(assetId) ?? "素材",
        url: preview?.url,
      });
    }
    return chips;
  }, [
    canvasReferenceActive,
    selectedCanvasItem,
    selectedRefs,
    mentionedAssetIds,
    mentionedAssetPreviews,
    canvasItems,
    uploadPreviews,
    videoReferences,
  ]);

  function handleRemoveReferenceChip(chip: ReferenceChipItem) {
    if (chip.variant === "canvas") {
      onClearCanvasSelection?.();
      return;
    }
    if (chip.variant === "mention-output") {
      setSelectedRefs((prev) => prev.filter((ref) => ref.id !== chip.id));
      setPrompt(removeMentionTokenFromPrompt(prompt, chip.label));
      return;
    }
    setMentionedAssetIds((prev) => prev.filter((id) => id !== chip.id));
    setMentionedAssetPreviews((prev) => prev.filter((p) => p.id !== chip.id));
    setPrompt(removeMentionTokenFromPrompt(prompt, chip.label));
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
        setAssetIds([]);
        setUploadPreviews([]);
        setSelectedRefs([]);
        setMentionedAssetIds([]);
        setMentionedAssetPreviews([]);
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
    setAssetIds([]);
    setUploadPreviews([]);
    setProductAssetId(null);
    setReferenceAssetId(null);
    setSelectedRefs([]);
    setMentionedAssetIds([]);
    setMentionedAssetPreviews([]);
    setMentionedMasks([]);
    setSelectedSkillId(null);
    setDockSkillId(isProductionStudio ? DRAMA_SKILL_ID : null);
    if (isProductionStudio) {
      setCreationLane("agent");
    }
  }, [sessionId, resetAgentRun, resetSkillRun, studioOrchestrationActive, setPrompt, isProductionStudio, setCreationLane]);

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

  useEffect(() => {
    if (!isProductionStudio) return;
    setDockSkillId(DRAMA_SKILL_ID);
    setCreationLane("agent");
  }, [isProductionStudio, setCreationLane]);

  const orchestrationResetTick = studioOrch?.orchestrationResetTick ?? 0;
  const lastOrchestrationResetRef = useRef(0);
  useEffect(() => {
    if (!studioOrchestrationActive) return;
    if (orchestrationResetTick <= lastOrchestrationResetRef.current) return;
    lastOrchestrationResetRef.current = orchestrationResetTick;
    setPrompt("");
    setAssetIds([]);
    setUploadPreviews([]);
    setProductAssetId(null);
    setReferenceAssetId(null);
    setSelectedRefs([]);
    setMentionedAssetIds([]);
    setMentionedAssetPreviews([]);
    setMentionedMasks([]);
    setSelectedSkillId(null);
    setDockSkillId(mode === "production" ? DRAMA_SKILL_ID : null);
    if (mode === "production") {
      setCreationLane("agent");
    }
  }, [studioOrchestrationActive, orchestrationResetTick, setPrompt, mode, setCreationLane]);

  const skillAwaitingConfirm = isSkillAwaitingConfirm(orchSkillRun);
  const skillInFlight = isSkillRunInFlight(orchSkillRun);
  const skillIdle =
    !orchSkillRun ||
    (["completed", "failed", "cancelled"] as SkillRunStatus[]).includes(
      orchSkillRun.status,
    );

  const resolveProductAssetId = () =>
    productAssetId ?? assetIds[0] ?? mentionedAssetIds[0] ?? undefined;

  const agentAwaitingConfirm = isAgentAwaitingConfirm(orchAgentRun);
  const agentInFlight = isAgentRunInFlight(orchAgentRun);
  const submitAriaLabel = skillAwaitingConfirm
    ? "确认执行套餐"
    : agentAwaitingConfirm
      ? "确认执行"
      : activeSkillId === DRAMA_SKILL_ID
        ? isProductionStudio
          ? "开始规划"
          : "开始短剧规划"
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

  const mentionUploadedAssets = useMemo(() => {
    const fromStack = uploadPreviews
      .filter((preview) => assetIds.includes(preview.id))
      .map((preview, idx) => ({
        id: preview.id,
        url: preview.url,
        label: `上传图${idx + 1}`,
      }));
    if (creationLane !== "video" || videoReferenceMode !== "omni") {
      return fromStack;
    }
    const fromVideo = videoRefsToMentionCandidates(videoReferences);
    const seen = new Set(fromStack.map((a) => a.id));
    return [
      ...fromStack,
      ...fromVideo
        .filter((v) => !seen.has(v.assetId))
        .map((v) => ({ id: v.assetId, url: v.url, label: v.label })),
    ];
  }, [
    uploadPreviews,
    assetIds,
    creationLane,
    videoReferenceMode,
    videoReferences,
  ]);

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
    if (!restoredAssets?.length || !sessionId) return;
    setAssetIds(restoredAssets.map((a) => a.id));
    setUploadPreviews(
      restoredAssets
        .filter((a) => a.url)
        .map((a) => ({
          id: a.id,
          url:
            a.url.startsWith("blob:") || a.url.startsWith("http")
              ? a.url
              : assetUrl(a.url),
        })),
    );
  }, [restoredAssets, sessionId]);

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

  function requireAuth(hint: string): boolean {
    if (user) return true;
    onAuthRequired?.(hint);
    return false;
  }

  async function handleUpload(selectedFiles: File[]) {
    if (!selectedFiles.length || !sessionId) return;
    if (!requireAuth("登录后即可上传参考图")) return;
    const target = uploadTargetRef.current;
    setUploading(true);
    try {
      /** 首页 sessionId 为客户端 UUID，须先 ensure 再上传，否则 assets FK 触发 500 */
      if (user) {
        await ensureSession(sessionId, mode);
        sessionEnsuredRef.current = true;
      }
      if (target === "product") {
        const asset = await uploadAsset(selectedFiles[0]!, sessionId);
        setProductAssetId(asset.id);
        return;
      }
      if (target === "reference") {
        const asset = await uploadAsset(selectedFiles[0]!, sessionId);
        setReferenceAssetId(asset.id);
        return;
      }
      const remaining = Math.max(0, 4 - assetIds.length);
      const batch = selectedFiles.slice(0, remaining);
      for (const file of batch) {
        const asset = await uploadAsset(file, sessionId);
        const previewUrl =
          asset.url.startsWith("http") || asset.url.startsWith("blob:")
            ? asset.url
            : assetUrl(asset.thumbUrl ?? asset.url);
        if (onUploadToCanvas) {
          // Studio：缩略图仅作 Dock 视觉反馈；生成参考仍靠画布点选 / @
          onUploadToCanvas(asset.id, asset.url, asset.thumbUrl);
          setUploadPreviews((prev) =>
            [...prev, { id: asset.id, url: previewUrl }].slice(0, 4),
          );
        } else {
          setAssetIds((prev) => [...prev, asset.id].slice(0, 4));
          setUploadPreviews((prev) =>
            [...prev, { id: asset.id, url: previewUrl }].slice(0, 4),
          );
        }
      }
      const extraFiles = selectedFiles.slice(remaining);
      for (const file of extraFiles) {
        const asset = await uploadAsset(file, sessionId);
        const previewUrl =
          asset.url.startsWith("http") || asset.url.startsWith("blob:")
            ? asset.url
            : assetUrl(asset.thumbUrl ?? asset.url);
        if (onUploadToCanvas) {
          onUploadToCanvas(asset.id, asset.url, asset.thumbUrl);
          setUploadPreviews((prev) =>
            [...prev, { id: asset.id, url: previewUrl }].slice(0, 4),
          );
        } else {
          setAssetIds((prev) => [...prev, asset.id].slice(0, 4));
          setUploadPreviews((prev) =>
            [...prev, { id: asset.id, url: previewUrl }].slice(0, 4),
          );
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
      uploadTargetRef.current = "general";
      setUploadTarget("general");
    }
  }

  function openUpload(target: "product" | "reference" | "general") {
    if (!sessionId) {
      onAuthRequired?.("会话未就绪，请刷新页面后重试");
      return;
    }
    if (homeDirectSubmit && !requireAuth("登录后即可上传参考图")) return;
    uploadTargetRef.current = target;
    setUploadTarget(target);
    fileRef.current?.click();
  }

  /**
   * 从 textarea 当前光标位置往前找到最近的 @，截取 [@..光标] 区间，
   * 用 chip 文本 `@${label} ` 整体替换，并把对应 assetId/outputId 落到提交字段。
   */
  function insertMention(item: MentionItem, promptSuffix = "") {
    const textarea = textareaRef.current;
    const labelTok = `@${item.label} `;
    const insertText = promptSuffix ? `${labelTok}${promptSuffix}` : labelTok;
    if (textarea) {
      const value = textarea.value;
      const caret = textarea.selectionStart ?? value.length;
      const before = value.slice(0, caret);
      const after = value.slice(caret);
      const atIdx = before.lastIndexOf("@");
      const replaceFrom = atIdx >= 0 ? atIdx : caret;
      const next = `${value.slice(0, replaceFrom)}${insertText}${after}`;
      setPrompt(next);
      requestAnimationFrame(() => {
        if (!textareaRef.current) return;
        const pos = replaceFrom + insertText.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(pos, pos);
      });
    } else {
      setPrompt((p) => `${p}${insertText}`);
    }

    if (item.source === "history-output" || item.source === "canvas-output") {
      const refLike: SessionReference = {
        id: item.outputId,
        url: item.url,
        label: item.label,
        createdAt: new Date().toISOString(),
      };
      setSelectedRefs((prev) =>
        prev.find((r) => r.id === refLike.id) ? prev : [...prev, refLike],
      );
    } else if (item.source === "canvas-asset" || item.source === "upload-asset") {
      setMentionedAssetIds((prev) =>
        prev.includes(item.assetId) ? prev : [...prev, item.assetId],
      );
      setMentionedAssetPreviews((prev) =>
        prev.find((p) => p.id === item.assetId)
          ? prev
          : [...prev, { id: item.assetId, url: item.url, label: item.label }],
      );
    }

    setMentionOpen(false);
    setMentionQuery("");
  }

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

  async function handlePromptReverse() {
    if (!sessionId) return;
    if (!requireAuth("登录后可使用图生文")) return;
    const assetId = assetIds[0];
    const imageUrl = uploadPreviews[0]?.url;
    if (!assetId && !imageUrl) {
      alert("请先上传参考图");
      return;
    }
    setReversing(true);
    try {
      const data = await reversePromptFromImage({
        sessionId,
        assetId,
        imageUrl: assetId ? undefined : imageUrl,
      });
      setPrompt(data.prompt);
      void trackEvent("prompt_reverse", { source: data.source });
    } catch (err) {
      alert(err instanceof Error ? err.message : "图生文失败");
    } finally {
      setReversing(false);
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

    const focusEditActive = Boolean(focusEdit?.points.length);
    const directSubmitContext = buildDirectSubmitContext({
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
      referenceImageSources: referenceImageSources,
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
          referenceImageSources: referenceImageSources,
          dramaSkillActive: activeSkillId === DRAMA_SKILL_ID,
        }),
      );
    const submitPath = resolveCreationSubmitPath({
      direct: directSubmitContext,
      orchestrationDispatchWouldHandle,
    });

    if (submitPath === "orchestration" && studioOrch) {
      setPending(true);
      try {
        const handled = await studioOrch.dispatchSubmit({
          prompt,
          creationLane,
          activeSkillId,
          effectiveMode,
          focusEditActive,
          mentionedMasksCount: mentionedMasks.length,
          submitVideo,
          hasReferenceImages: hasRefs,
          productAssetId: resolveProductAssetId(),
          referenceAssetId: referenceAssetId ?? undefined,
        });
        if (handled) return;
      } catch (err) {
        alert(err instanceof Error ? err.message : "提交失败");
      } finally {
        setPending(false);
      }
    }

    if (submitPath === "skill" && activeSkillId) {
      setPending(true);
      try {
        const skillResult = await submitSkillOrchestration({
          prompt,
          activeSkillId,
          productAssetId: resolveProductAssetId(),
          referenceAssetId: referenceAssetId ?? undefined,
          skillRun: orchSkillRun,
          ensureSession: () => ensureSession(sessionId, mode),
          confirmRun: confirmSkillRunAction,
          startRun: startSkillRun,
          onValidationError: (message) => alert(message),
          onStarted: () => {
            void trackEvent("skill_run_start", {
              sessionId: sessionId ?? "",
              skillId: activeSkillId,
            });
          },
        });
        if (skillResult === "validation_failed" || skillResult === "in_flight") {
          return;
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : "套餐提交失败");
      } finally {
        setPending(false);
      }
      return;
    }

    if (submitPath === "agent") {
      setPending(true);
      try {
        const agentResult = await submitAgentOrchestration({
          prompt,
          agentRun: orchAgentRun,
          ensureSession: () => ensureSession(sessionId, mode),
          confirmRun: confirmAgentRunAction,
          startRun: startAgentRun,
          onStarted: () => {
            void trackEvent("agent_run_start", {
              sessionId: sessionId ?? "",
              mode,
            });
          },
        });
        if (agentResult === "in_flight") return;
      } catch (err) {
        alert(err instanceof Error ? err.message : "Agent 提交失败");
      } finally {
        setPending(false);
      }
      return;
    }

    if (submitPath === "focus-edit" && focusEdit?.points.length && onFocusEditSubmit) {
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

    setPending(true);
    try {
      await ensureSession(sessionId, mode);
      const submitLineage = resolveSubmitBatchLineage(canvasItems, {
        maskSelection:
          mentionedMasks.length > 0
            ? mentionedMasks[mentionedMasks.length - 1]
            : null,
        referenceOutputIds:
          selectedRefs.length > 0 ? selectedRefs.map((r) => r.id) : undefined,
        toolName: mentionedMasks[mentionedMasks.length - 1]?.toolId,
      });
      const lineageApi = pendingLineageToApiFields(submitLineage);
      let jobId: string;
      if (submitVideo) {
        const videoModel = models.find((m) => m.type === "video");
        if (!videoModel) {
          alert("当前暂无可用视频模型");
          return;
        }
        const videoModelId = resolveVideoSubmitModelId(
          modelId,
          models,
          videoAutoMeta,
        );
        const route =
          getVideoModelRoute(videoModelId) ??
          videoRoutes.find((r) => r.modelId === videoModelId);
        if (route && !route.available) {
          alert(route.unavailableReason ?? "该视频模型当前不可用");
          return;
        }
        const degradeHint = capabilityDegradationMessage(videoModelId);
        if (degradeHint && !window.confirm(`${degradeHint}，是否继续？`)) {
          return;
        }
        if (videoReferenceMode === "omni" && videoReferences.length > 0) {
          const mentionCheck = validateOmniVideoMentions(prompt, videoReferences);
          if (!mentionCheck.ok) {
            alert(mentionCheck.message ?? "请检查 @ 引用");
            return;
          }
        }
        const videoRefs = buildReferenceSources();
        const videoAssetIds = Array.from(
          new Set([...videoRefs.assetIds, ...videoRefs.mentionedAssetIds]),
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
          aspectRatio: videoSubmitAspectRatio(),
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
            videoRefs.selectedRefIds,
          ),
          sourceLane: "video",
          ...lineageApi,
        });
        jobId = res.jobId;
      } else if (submitEcommerce) {
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
        jobId = res.jobId;
        setRouteHint(res.routeReason);
        setProductAssetId(null);
        setReferenceAssetId(null);
      } else {
        const useAuto = modelId === AUTO_MODEL_ID;
        const imageRefs = buildReferenceSources();
        const mergedAssetIds = Array.from(
          new Set([...imageRefs.assetIds, ...imageRefs.mentionedAssetIds]),
        );
        const toolEdit = mentionedMasks.length > 0;
        const res = await submitGeneration({
          sessionId,
          prompt: prompt.trim(),
          modelId: useAuto ? undefined : modelId,
          count: toolEdit ? 1 : count,
          resolution,
          aspectRatio: coerceAspectRatio(aspectRatio),
          mode: effectiveMode === "ecommerce" ? "ecommerce" : "image",
          assetIds: mergedAssetIds.length ? mergedAssetIds : undefined,
          referenceOutputIds: normalizeReferenceOutputIds(
            imageRefs.selectedRefIds,
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
        jobId = res.jobId;
        if (res.routeReason) setRouteHint(res.routeReason);
        else if (res.byokActive) setRouteHint("BYOK 已启用 · 将使用您的 OpenAI Key");
      }
      if (homeDirectSubmit) {
        setNavigating(true);
        clientNavigate(
          router,
          `/studio?sessionId=${encodeURIComponent(sessionId)}&mode=${encodeURIComponent(mode)}&jobId=${encodeURIComponent(jobId)}`,
          "replace",
        );
      }
      setPrompt("");
      setAssetIds([]);
      setUploadPreviews([]);
      setSelectedRefs([]);
      setMentionedAssetIds([]);
      setMentionedAssetPreviews([]);
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

  const body = (
    <>
      {showDockJobStatusBar ? (
        <div
          className={`mb-2 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
            jobStreamStatus === "failed"
              ? "border-red-500/30 bg-red-500/5 text-red-300"
              : "border-orange-500/20 bg-orange-500/5 text-orange-200/90"
          }`}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {streamBusy ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin" />
              ) : null}
              <span>{jobStatusLabel(jobStreamStatus)}</span>
            </div>
            {jobStatusSubtext ? (
              <p className="mt-0.5 text-[10px] text-zinc-500">{jobStatusSubtext}</p>
            ) : null}
          </div>
          {streamBusy && pollingJobId && onCancelJob ? (
            <button
              type="button"
              onClick={onCancelJob}
              className="rounded-md bg-white/10 px-2 py-1 text-xs text-zinc-300 transition hover:bg-white/20 hover:text-white"
              title="取消任务"
            >
              取消
            </button>
          ) : null}
        </div>
      ) : null}

      {activeSkillId === DRAMA_SKILL_ID && agentLaneAvailable ? (
        <DramaCoach active />
      ) : null}

      {!effectiveCollapsed && inspirationApply && (inspirationApply.variables?.length ?? 0) > 0 ? (
        <div className="mb-3 rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
          <p className="mb-2 text-xs font-medium text-orange-200/90">
            同款模板 · {inspirationApply.title}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {inspirationApply.variables!.map((v) => (
              <label key={v.key} className="block space-y-1">
                <span className="text-[10px] text-zinc-500">{v.label}</span>
                <input
                  type="text"
                  value={inspirationVars[v.key] ?? v.default}
                  onChange={(e) =>
                    setInspirationVars((prev) => ({
                      ...prev,
                      [v.key]: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-orange-500/40"
                />
              </label>
            ))}
          </div>
        </div>
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
            {dockCompactLine && creationLane === "agent" && agentLaneAvailable ? (
              <div className="min-w-0 shrink-0 scale-90">
                <SkillDockPicker
                  options={dockSkillOptions}
                  value={dockSkillId}
                  onChange={handleDockSkillChange}
                  disabled={readOnly || pending || streamBusy}
                  triggerLabel={isStudioDock ? "创意设计" : "使用技能"}
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
                    const sourceLabel = (
                      source: "template-mock" | "openai" | "dashscope",
                    ) => {
                      if (source === "dashscope") return "百炼";
                      if (source === "openai") return "OpenAI";
                      return "模板";
                    };
                    if (!user || !getToken()) {
                      setPrompt(polishPrompt(polishApiMode, raw));
                      setPolishHint("模板");
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
                      },
                    })
                      .then((res) => {
                        setPrompt(res.prompt);
                        setPolishHint(sourceLabel(res.source));
                      })
                      .catch(() => {
                        setPrompt(polishPrompt(polishApiMode, raw));
                        setPolishHint("模板");
                      })
                      .finally(() => setPolishBusy(false));
                  }}
                  className={`absolute bottom-1 right-1 rounded-lg p-1.5 transition ${
                    prompt.trim() && !polishBusy
                      ? "text-orange-400 hover:bg-white/10 hover:text-orange-300"
                      : "text-zinc-600 opacity-70"
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
        !isStudioDock ? (
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
              dockSkillOptions={dockSkillOptions}
              dockSkillId={dockSkillId}
              onDockSkillChange={handleDockSkillChange}
              skillTriggerLabel="创意设计"
              onInspirationClick={onInspirationClick}
              inspirationActive={inspirationActive}
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
              <Pill>最新图片 V2 Pro · 4 张 · 2K</Pill>
              <Pill>
                智能 · {resolution.toUpperCase()} · 1:1 套图
              </Pill>
            </>
          )}
        </div>
        <div className={`flex shrink-0 items-center ${isDock ? "gap-1.5" : "gap-2"}`}>
          {isProductionStudio &&
          studioOrchestrationActive &&
          activeSkillId === DRAMA_SKILL_ID &&
          studioOrch ? (
            <DramaProductionDockParams
              targetDurationSec={studioOrch.dramaTargetDurationSec}
              aspectRatio={studioOrch.dramaAspectRatio}
              onTargetDurationSecChange={studioOrch.setDramaTargetDurationSec}
              onAspectRatioChange={studioOrch.setDramaAspectRatio}
              disabled={readOnly || pending || streamBusy}
            />
          ) : null}
          {studioOrchestrationActive &&
          activeSkillId === DRAMA_SKILL_ID &&
          studioOrch ? (
            <label
              className="mr-1 flex items-center gap-1.5 text-[10px] text-zinc-400"
              data-testid="drama-auto-produce-checkbox"
            >
              <input
                type="checkbox"
                checked={studioOrch.dramaAutoProduce}
                onChange={(e) =>
                  studioOrch.setDramaAutoProduce(e.target.checked)
                }
                disabled={readOnly || pending || streamBusy}
              />
              规划后直接制作
            </label>
          ) : null}
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

  function handleDockDragEnter(e: React.DragEvent) {
    if (!isDock || readOnly) return;
    if (!dataTransferHasFiles(e.dataTransfer)) return;
    e.preventDefault();
    dockDragDepthRef.current += 1;
    setDockDragOver(true);
  }

  function handleDockDragLeave(e: React.DragEvent) {
    if (!isDock || readOnly) return;
    e.preventDefault();
    dockDragDepthRef.current = Math.max(0, dockDragDepthRef.current - 1);
    if (dockDragDepthRef.current === 0) setDockDragOver(false);
  }

  function handleDockDragOver(e: React.DragEvent) {
    if (!isDock || readOnly) return;
    if (!dataTransferHasFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  function handleDockDrop(e: React.DragEvent) {
    if (!isDock || readOnly) return;
    e.preventDefault();
    dockDragDepthRef.current = 0;
    setDockDragOver(false);
    const files = imageFilesFromDataTransfer(e.dataTransfer);
    if (!files.length) {
      onInteractionHint?.("仅支持拖拽 JPG / PNG / WebP 图片");
      return;
    }
    uploadTargetRef.current = "general";
    setUploadTarget("general");
    void handleUpload(files);
  }

  if (isDock) {
    const panel = (
      <div
        data-testid="creation-dock-drop-zone"
        data-drag-active={dockDragOver ? "true" : undefined}
        onDragEnter={handleDockDragEnter}
        onDragLeave={handleDockDragLeave}
        onDragOver={handleDockDragOver}
        onDrop={handleDockDrop}
        className={`relative w-full overflow-visible rounded-[1.5rem] border bg-gradient-to-b from-white/[0.07] via-zinc-950/76 to-zinc-950/92 shadow-[0_12px_48px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)_inset,0_-18px_42px_rgba(249,115,22,0.06),0_12px_48px_rgba(139,92,246,0.05)] backdrop-blur-2xl backdrop-saturate-150 transition ${
          dockDragOver
            ? "border-orange-400/50 ring-2 ring-orange-500/35"
            : "border-white/[0.12]"
        }`}
      >
        <div
          className="pointer-events-none absolute -left-10 top-0 h-28 w-28 rounded-full bg-orange-500/[0.08] blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-8 top-2 h-24 w-24 rounded-full bg-violet-500/[0.08] blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
          aria-hidden
        />
        {onDockModeChange ? (
          <StudioDockFocusButton onModeChange={onDockModeChange} />
        ) : null}
        {body}
      </div>
    );
    return (
      <>
        <HomeGenerationPreview open={navigating || (pending && homeDirectSubmit)} />
        {uploadPreviewIndex != null && uploadPreviews.length > 0 ? (
          <CanvasLightbox
            items={uploadPreviews.map((item, i) => ({
              id: item.id,
              url: item.url,
              label: `上传图 ${i + 1}`,
            }))}
            initialIndex={Math.min(uploadPreviewIndex, uploadPreviews.length - 1)}
            onClose={() => setUploadPreviewIndex(null)}
          />
        ) : null}
        {panel}
      </>
    );
  }

  return (
    <>
      <HomeGenerationPreview open={navigating || (pending && homeDirectSubmit)} />
      {uploadPreviewIndex != null && uploadPreviews.length > 0 ? (
        <CanvasLightbox
          items={uploadPreviews.map((item, i) => ({
            id: item.id,
            url: item.url,
            label: `上传图 ${i + 1}`,
          }))}
          initialIndex={Math.min(uploadPreviewIndex, uploadPreviews.length - 1)}
          onClose={() => setUploadPreviewIndex(null)}
        />
      ) : null}
      <GlassPanel
        className={`mx-auto w-full max-w-3xl p-4 sm:p-5 ${compact ? "" : "shadow-orange-500/5"}`}
      >
        {body}
      </GlassPanel>
    </>
  );
}

function TagSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300 outline-none"
    >
      {options.map((o) => (
        <option key={o} value={o} className="bg-zinc-900">
          {o}
        </option>
      ))}
    </select>
  );
}

function UploadSlot({
  label,
  onClick,
  loading,
}: {
  label: string;
  onClick?: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/15 bg-black/30 text-xs text-zinc-400 transition hover:border-orange-500/40 hover:bg-white/5"
    >
      {loading ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <ImagePlus className="size-5" />
      )}
      {label}
    </button>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300">
      {children}
    </span>
  );
}
