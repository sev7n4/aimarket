"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp,
  AtSign,
  ImagePlus,
  Loader2,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  Button,
  GlassPanel,
  ModeTabs,
  type CreationMode,
} from "@aimarket/ui";
import { modeTabs, placeholders } from "@/lib/modes";
import {
  assetUrl,
  ensureSession,
  estimatePoints,
  getToken,
  fetchModels,
  fetchReferences,
  fetchProviderStatus,
  submitEcommerceGenerate,
  submitGeneration,
  submitVideoGeneration,
  suggestModel,
  uploadAsset,
  trackEvent,
  optimizePromptApi,
  reversePromptFromImage,
  renderInspiration,
} from "@/lib/api-client";
import { polishPrompt } from "@/lib/prompt-polish";
import { jobStatusLabel } from "@/lib/job-stream";
import type { ImageModel } from "@/lib/types";
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
import { storePendingAssets, type PendingAsset } from "@/lib/pending-assets";
import { HomeGenerationPreview } from "@/components/home-generation-preview";
import {
  UploadPreviewStack,
  type UploadPreviewItem,
} from "@/components/upload-preview-stack";
import {
  GenerationSettingsPopover,
  type AspectRatio,
} from "@/components/generation-settings-popover";
import { ModelPicker, AUTO_MODEL_ID } from "@/components/model-picker";
import { CountPicker } from "@/components/count-picker";
import type { StudioInspirationApply } from "@/lib/inspiration-studio";
import { FocusEditChips } from "@/components/focus-edit-chips";
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
  variant?: "default" | "dock";
  mode?: CreationMode;
  onModeChange?: (mode: CreationMode) => void;
  showModeTabs?: boolean;
  sessionId?: string;
  onAuthRequired?: () => void;
  onJobStarted?: (jobId: string, lineage?: PendingBatchLineage) => void;
  /** Studio 父级 SSE/轮询推送的状态（对标椒图进度感） */
  jobStreamStatus?: string | null;
  /** 当前正在运行的任务ID，用于取消任务 */
  pollingJobId?: string | null;
  /** 取消任务的回调 */
  onCancelJob?: () => void;
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
  /** Studio Dock 内嵌：去掉 CreationPanel 自身外框，由 Dock 容器提供 */
  embeddedInDock?: boolean;
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
  onUploadToCanvas?: (assetId: string, url: string) => void;
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
  onJobStarted,
  jobStreamStatus = null,
  pollingJobId = null,
  onCancelJob,
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
  embeddedInDock = false,
  canvasItems = [],
  mentionItemRequest = null,
  focusEdit = null,
  onFocusEditSubmit,
  prompt: controlledPrompt,
  onPromptChange,
  onUploadToCanvas,
}: CreationPanelProps) {
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
  const [modelId, setModelId] = useState(AUTO_MODEL_ID);
  const [models, setModels] = useState<ImageModel[]>([]);
  const [count, setCount] = useState(1);
  const [resolution, setResolution] = useState("1k");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [estimated, setEstimated] = useState<number | null>(null);
  const [routeHint, setRouteHint] = useState<string | null>(null);
  const [inspirationVars, setInspirationVars] = useState<
    Record<string, string>
  >({});
  const [pending, setPending] = useState(false);
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [productAssetId, setProductAssetId] = useState<string | null>(null);
  const [referenceAssetId, setReferenceAssetId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [references, setReferences] = useState<SessionReference[]>([]);
  const [selectedRefs, setSelectedRefs] = useState<SessionReference[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  /** @ 后的查询字符串（从光标往前找 @ 截取） */
  const [mentionQuery, setMentionQuery] = useState("");
  /** 已通过 @ 引用的 canvas-asset 项，提交时把 assetId 合并到请求 */
  const [mentionedAssetIds, setMentionedAssetIds] = useState<string[]>([]);
  const [mentionedAssetPreviews, setMentionedAssetPreviews] = useState<
    UploadPreviewItem[]
  >([]);
  const [mentionedMasks, setMentionedMasks] = useState<CanvasMaskSelection[]>(
    [],
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [navigating, setNavigating] = useState(false);
  const [uploadPreviews, setUploadPreviews] = useState<UploadPreviewItem[]>([]);
  const [reversing, setReversing] = useState(false);

  const rotatingText = useRotatingPlaceholder(
    mode,
    !rotatingPlaceholder || prompt.trim().length > 0,
  );
  const isDock = variant === "dock";
  /**
   * dock 模式（首页 + Studio 工作台）下统一走简洁对话流程，
   * 不再渲染电商 Agent 表单 / 走电商套图提交分支。
   */
  const effectiveMode: CreationMode = isDock && mode === "ecommerce" ? "chat" : mode;
  const selectedModel =
    modelId === AUTO_MODEL_ID ? undefined : models.find((m) => m.id === modelId);
  const isVideoModel = selectedModel?.type === "video";
  const showStackUpload =
    (leadingUpload || (isDock && !embeddedInDock)) &&
    effectiveMode !== "ecommerce";

  useEffect(() => {
    fetchModels()
      .then(setModels)
      .catch(() => setModels([]));
  }, []);

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
    if (!inspirationApply) return;
    setPrompt(inspirationApply.prompt);
    setModelId(inspirationApply.modelId);
    setAspectRatio(coerceAspectRatio(inspirationApply.aspectRatio));
    setResolution(inspirationApply.resolution);
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
    } else if (mode === "quick") {
      setCount(1);
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
    fetchReferences(sessionId)
      .then(setReferences)
      .catch(() => setReferences([]));
  }, [user, sessionId, canvasMentionSignature]);

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
    const hasReferenceImages =
      assetIds.length > 0 ||
      mentionedAssetIds.length > 0 ||
      selectedRefs.length > 0;
    const t = setTimeout(() => {
      suggestModel(mode, prompt, hasReferenceImages)
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
    effectiveMode,
  ]);

  async function handleUpload(files: FileList | null) {
    if (!files?.length || !sessionId) return;
    if (!user) {
      onAuthRequired?.();
      return;
    }
    const target = uploadTargetRef.current;
    setUploading(true);
    try {
      if (target === "product") {
        const asset = await uploadAsset(files[0], sessionId);
        setProductAssetId(asset.id);
        return;
      }
      if (target === "reference") {
        const asset = await uploadAsset(files[0], sessionId);
        setReferenceAssetId(asset.id);
        return;
      }
      const remaining = Math.max(0, 4 - assetIds.length);
      const batch = Array.from(files).slice(0, remaining);
      for (const file of batch) {
        const asset = await uploadAsset(file, sessionId);
        setAssetIds((prev) => [...prev, asset.id].slice(0, 4));
        setUploadPreviews((prev) =>
          [...prev, { id: asset.id, url: asset.url }].slice(0, 4),
        );
        if (onUploadToCanvas) {
          onUploadToCanvas(asset.id, asset.url);
        }
      }
      const extraFiles = Array.from(files).slice(remaining);
      for (const file of extraFiles) {
        const asset = await uploadAsset(file, sessionId);
        if (onUploadToCanvas) {
          onUploadToCanvas(asset.id, asset.url);
        }
      }
    } finally {
      setUploading(false);
      uploadTargetRef.current = "general";
      setUploadTarget("general");
    }
  }

  function openUpload(target: "product" | "reference" | "general") {
    if (!sessionId) {
      onAuthRequired?.();
      return;
    }
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
          : [...prev, { id: item.assetId, url: item.url }],
      );
    }

    setMentionOpen(false);
    setMentionQuery("");
  }

  useEffect(() => {
    if (!mentionItemRequest) return;
    const index = canvasItems.findIndex(
      (item) => item.id === mentionItemRequest.item.id,
    );
    const mention = canvasItemToMentionItem(
      mentionItemRequest.item,
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
    if (!user || !sessionId) {
      onAuthRequired?.();
      return;
    }
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

  async function handleSubmit() {
    if (readOnly) return;
    if (!prompt.trim() && effectiveMode !== "ecommerce") return;
    if (effectiveMode === "ecommerce") {
      if (prompt.trim().length < 10) {
        alert("请填写至少 10 字的产品卖点/描述");
        return;
      }
      if (!productAssetId) {
        alert("请先上传产品图");
        return;
      }
    }

    const hasReferenceImages = mentionedAssetIds.length > 0 || selectedRefs.length > 0;
    if (hasReferenceImages && modelId === AUTO_MODEL_ID) {
      try {
        const providerStatus = await fetchProviderStatus();
        if (!providerStatus.seedreamConfigured && !providerStatus.aliyunWanConfigured) {
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

    const shouldNavigate =
      shouldNavigateOnSubmit || (homeDirectSubmit && !user);

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
      router.push(`/studio?${params.toString()}`);
      return;
    }

    if (!user) {
      onAuthRequired?.();
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
      if (isVideoModel) {
        const res = await submitVideoGeneration({
          sessionId,
          prompt: prompt.trim(),
          modelId,
          count,
          ...lineageApi,
        });
        jobId = res.jobId;
      } else if (effectiveMode === "ecommerce") {
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
        const mergedAssetIds = Array.from(
          new Set([...assetIds, ...mentionedAssetIds]),
        );
        const res = await submitGeneration({
          sessionId,
          prompt: prompt.trim(),
          modelId: useAuto ? undefined : modelId,
          count,
          resolution,
          aspectRatio,
          mode,
          assetIds: mergedAssetIds.length ? mergedAssetIds : undefined,
          referenceOutputIds: selectedRefs.map((r) => r.id),
          autoRoute: useAuto,
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
        if (res.modelId && useAuto) setModelId(res.modelId);
      }
      setPrompt("");
      setAssetIds([]);
      setUploadPreviews([]);
      setSelectedRefs([]);
      setMentionedAssetIds([]);
      setMentionedAssetPreviews([]);
      setMentionedMasks([]);
      await refreshUser();
      void trackEvent("generation_submit", { mode, sessionId });
      onJobStarted?.(jobId, submitLineage);
      if (sessionId) {
        const refs = await fetchReferences(sessionId);
        setReferences(refs);
      }
      if (homeDirectSubmit) {
        setNavigating(true);
        router.replace(
          `/studio?sessionId=${sessionId}&mode=${mode}&jobId=${jobId}`,
        );
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "提交失败");
    } finally {
      setPending(false);
    }
  }

  const focusEditReady =
    Boolean(focusEdit?.points.length) && prompt.trim().length > 0;

  const canSubmit =
    !readOnly &&
    !jobStreamStatus &&
    (focusEdit
      ? focusEditReady && !focusEdit.recognizing
      : effectiveMode === "ecommerce"
        ? prompt.trim().length >= 10 && Boolean(productAssetId)
        : prompt.trim().length > 0);

  const streamBusy =
    Boolean(jobStreamStatus) &&
    jobStreamStatus !== "succeeded" &&
    jobStreamStatus !== "failed";

  const body = (
    <>
      {jobStreamStatus ? (
        <div
          className={`mb-2 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
            jobStreamStatus === "failed"
              ? "border-red-500/30 bg-red-500/5 text-red-300"
              : "border-orange-500/20 bg-orange-500/5 text-orange-200/90"
          }`}
        >
          <div className="flex items-center gap-2">
            {streamBusy ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin" />
            ) : null}
            <span>{jobStatusLabel(jobStreamStatus)}</span>
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

      {!collapsed && inspirationApply && (inspirationApply.variables?.length ?? 0) > 0 ? (
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
          void handleUpload(e.target.files);
          e.target.value = "";
        }}
      />

      <div className={`relative ${isDock ? "" : "mt-3"}`}>
        <MentionPicker
          placement={isDock ? "below" : "above"}
          canvasItems={canvasItems}
          uploadedAssets={uploadPreviews
            .filter((preview) => assetIds.includes(preview.id))
            .map((preview, idx) => ({
              id: preview.id,
              url: preview.url,
              label: `上传图${idx + 1}`,
            }))}
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
              ? embeddedInDock
                ? "px-3 pb-2 pt-1 sm:px-3"
                : "rounded-2xl border border-white/10 bg-[#141414] px-3 pb-3 pt-3 sm:px-4 sm:pt-4"
              : ""
          }
        >
          <div className="relative flex gap-3">
            {onInspirationClick ? (
              <button
                type="button"
                onClick={onInspirationClick}
                aria-label={
                  inspirationActive ? "收起灵感套图" : "查看灵感套图"
                }
                aria-pressed={inspirationActive}
                className={`relative flex size-14 shrink-0 -rotate-6 items-center justify-center overflow-hidden rounded-xl border bg-gradient-to-br from-orange-500/20 to-purple-600/20 text-orange-200 shadow-[0_4px_18px_rgba(249,115,22,0.18)] transition hover:rotate-0 hover:shadow-[0_6px_22px_rgba(249,115,22,0.28)] ${
                  inspirationActive
                    ? "border-orange-300/80 ring-2 ring-orange-300/50"
                    : "border-orange-300/40"
                }`}
              >
                {inspirationCoverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={inspirationCoverUrl}
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <Sparkles className="relative size-5 drop-shadow" />
                <span className="absolute bottom-0.5 left-0.5 right-0.5 text-center text-[8px] font-medium text-white/90 drop-shadow">
                  灵感套图
                </span>
              </button>
            ) : null}
            {showStackUpload ? (
              <UploadPreviewStack
                items={uploadPreviews}
                uploading={uploading}
                onAdd={() => openUpload("general")}
                onRemove={(id) => {
                  setUploadPreviews((prev) => prev.filter((p) => p.id !== id));
                  setAssetIds((prev) => prev.filter((a) => a !== id));
                }}
              />
            ) : null}
            <div className="relative min-w-0 flex-1">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => {
                  const v = e.target.value;
                  setPrompt(v);
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
                  rotatingPlaceholder && !prompt.trim()
                    ? rotatingText
                    : effectiveMode === "ecommerce"
                      ? placeholders.ecommerce
                      : mode === "chat"
                        ? "输入想要的修改效果，@ 可引用画布上的图片"
                        : placeholders[mode]
                }
                rows={
                  collapsed ? 1 : effectiveMode === "ecommerce" ? 3 : isDock ? 2 : 2
                }
                readOnly={readOnly}
                className={`w-full resize-none bg-transparent text-sm outline-none placeholder:text-zinc-600 ${
                  readOnly ? "cursor-not-allowed opacity-60" : ""
                } ${
                  isDock
                    ? `${collapsed ? "min-h-[28px]" : "min-h-[56px]"} pr-9 text-zinc-100`
                    : "rounded-2xl border border-white/10 bg-black/40 px-4 py-3 focus:border-purple-500/40"
                }`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void handleSubmit();
                  }
                }}
              />
              {enablePolish ? (
                <button
                  type="button"
                  title={
                    prompt.trim()
                      ? "润色 Prompt"
                      : "输入描述后可一键润色"
                  }
                  disabled={!prompt.trim()}
                  onClick={() => {
                    const raw = prompt.trim();
                    if (!raw) return;
                    if (user && getToken()) {
                      void optimizePromptApi(raw, mode)
                        .then(setPrompt)
                        .catch(() => setPrompt(polishPrompt(mode, raw)));
                    } else {
                      setPrompt(polishPrompt(mode, raw));
                    }
                  }}
                  className={`absolute bottom-1 right-1 rounded-lg p-1.5 transition ${
                    prompt.trim()
                      ? "text-orange-400 hover:bg-white/10 hover:text-orange-300"
                      : "text-zinc-600 opacity-70"
                  }`}
                  aria-label="润色描述"
                >
                  <Wand2 className="size-4" />
                </button>
              ) : null}
            </div>
          </div>
        {selectedRefs.length > 0 ? (
          <p className="mt-1 text-xs text-purple-400">
            @ 引用了 {selectedRefs.length} 张生成图
          </p>
        ) : null}
        {mentionedAssetIds.length > 0 ? (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-purple-400">
            <span>@ 引用了 {mentionedAssetIds.length} 张素材图</span>
            <span className="flex -space-x-1">
              {mentionedAssetPreviews.slice(0, 4).map((item) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={item.id}
                  src={item.url}
                  alt=""
                  className="size-5 rounded border border-black/40 object-cover"
                />
              ))}
            </span>
          </div>
        ) : null}
        {mentionedMasks.length > 0 ? (
          <p className="mt-1 text-xs text-amber-300">
            已圈选 {mentionedMasks.length} 个局部区域，将随提示词一起提交
          </p>
        ) : null}
        {focusEdit ? (
          <FocusEditChips
            points={focusEdit.points}
            intent={focusEdit.intent}
            cropSize={focusEdit.cropSize}
            recognizing={focusEdit.recognizing}
            onIntentChange={focusEdit.onIntentChange}
            onRemove={focusEdit.onRemovePoint}
            onEdit={focusEdit.onEditPoint}
            onCropSizeChange={focusEdit.onCropSizeChange}
            onCancel={focusEdit.onCancel}
          />
        ) : null}
        {assetIds.length > 0 ? (
          <p className="mt-1 text-xs text-zinc-500">
            已上传 {assetIds.length} 张附件
          </p>
        ) : null}
        {routeHint ? (
          <p className="mt-1 text-xs text-orange-400/80">路由：{routeHint}</p>
        ) : null}

          {collapsed ? (
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                {!showStackUpload ? (
                  <button
                    type="button"
                    onClick={() => openUpload("general")}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
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
                    onClick={() => setMentionOpen((o) => !o)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                    aria-label="引用画布图片"
                    title="@ 引用画布图片"
                  >
                    <AtSign className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <Button
                variant="primary"
                className="size-9 shrink-0 rounded-full p-0"
                onClick={() => void handleSubmit()}
                disabled={readOnly || pending || streamBusy || !canSubmit}
                aria-label="开始生成"
              >
                {pending ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <ArrowUp className="size-5" />
                )}
              </Button>
            </div>
          ) : (
          <div
            className={`flex items-center justify-between gap-2 ${isDock ? "mt-3" : "mt-3"}`}
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
              className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
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
              onClick={() => setMentionOpen((o) => !o)}
              className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
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
              className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 disabled:opacity-50"
              aria-label="图生文"
            >
              {reversing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
            </button>
          ) : null}
          {effectiveMode !== "ecommerce" ? (
            <>
              <ModelPicker
                models={models}
                value={modelId}
                onChange={setModelId}
              />
              <CountPicker value={count} onChange={setCount} max={4} />
            </>
          ) : (
            <Pill>最新图片 V2 Pro · 4 张 · 2K</Pill>
          )}
          {effectiveMode === "ecommerce" ? (
            <Pill>
              智能 · {resolution.toUpperCase()} · 1:1 套图
            </Pill>
          ) : (
            <GenerationSettingsPopover
              mode={mode}
              resolution={resolution}
              aspectRatio={aspectRatio}
              onResolutionChange={setResolution}
              onAspectRatioChange={setAspectRatio}
              videoMode={isVideoModel}
            />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {estimated !== null && user && getToken() ? (
            <span
              className="inline-flex items-center gap-1 text-xs text-pink-400"
              title="预估本次消耗积分"
            >
              <Sparkles className="size-3.5 fill-pink-400/30" />
              <span className="hidden sm:inline">约</span>
              {estimated}
            </span>
          ) : null}
          <Button
            variant="primary"
            className="size-9 shrink-0 rounded-full p-0 sm:size-10"
            onClick={() => void handleSubmit()}
            disabled={readOnly || pending || streamBusy || !canSubmit}
            aria-label="开始生成"
          >
            {pending ? (
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

  if (isDock) {
    return (
      <>
        <HomeGenerationPreview open={navigating || (pending && homeDirectSubmit)} />
        <div className="w-full">{body}</div>
      </>
    );
  }

  return (
    <>
      <HomeGenerationPreview open={navigating || (pending && homeDirectSubmit)} />
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
