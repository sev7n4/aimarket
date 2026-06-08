"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SessionTitleActions } from "@/components/session-title-actions";
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Plus,
  X,
} from "lucide-react";
import { LoginDialog } from "@/components/login-dialog";
import {
  DesignCanvas,
  type DesignCanvasHandle,
} from "@/components/design-canvas";
import { StudioCreationDock } from "@/components/studio-creation-dock";
import { CanvasSelectionToolbar } from "@/components/canvas-selection-toolbar";
import { StudioDock, studioDockScrollInset } from "@/components/studio-dock";
import { StudioCoach } from "@/components/studio-coach";
import { StudioHeader } from "@/components/studio-header";
import { BrandLogo } from "@/components/brand-logo";
import { ProviderStatusChip } from "@/components/provider-status-banner";
import { ContentReportDialog } from "@/components/content-report-dialog";
import {
  ToolConfirmDialog,
  type ToolConfirmOptions,
  type ToolConfirmRequest,
} from "@/components/tool-confirm-dialog";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { StudioWorkspaceFooter } from "@/components/studio-workspace-footer";
import { WorkspaceProvider } from "@/lib/workspace-context";
import {
  defaultStudioDockMode,
  persistStudioDockMode,
  readStudioDockMode,
  type StudioDockMode,
} from "@/lib/studio-dock-state";
import { getActiveWorkspaceId } from "@/lib/active-workspace";
import { MOBILE_BREAKPOINT } from "@/lib/breakpoints";
import { resolveApiBase } from "@/lib/api-base";
import { copyTextToClipboard } from "@/lib/clipboard";
import { formatJobErrorMessage } from "@/lib/job-error-message";
import { type CreationMode } from "@aimarket/ui";
import type { ImageSession, StudioTool } from "@/lib/types";
import type { CanvasItem, CanvasMaskSelection } from "@/lib/canvas-tools";
import { StudioOrchestrationProvider } from "@/components/studio-orchestration-provider";
import { StudioCanvasWithOrchestration } from "@/components/studio-canvas-with-orchestration";
import { useAuth } from "@/lib/auth-context";
import {
  assetUrl,
  cancelJob,
  ensureSession,
  exportSession,
  fetchJob,
  fetchTools,
  listSessions,
  publishCanvasToInspiration,
  recognizeFocusPoint,
  runTool,
  submitGeneration,
  uploadAsset,
  trackEvent,
} from "@/lib/api-client";
import {
  MAX_FOCUS_POINTS,
  DEFAULT_CROP_SIZE,
  type FocusEditSession,
  type FocusPointChip,
} from "@/lib/focus-edit";
import {
  createUploadCanvasItem,
  pickLatestBatchFocusTarget,
  type PendingBatchLineage,
} from "@/lib/canvas-tools";
import {
  coerceInspirationAspect,
  importInspirationReferencesToCanvas,
  type StudioInspirationApply,
} from "@/lib/inspiration-studio";
import { persistCreationLane } from "@/lib/creation-dock-prefs";
import {
  invalidateSessionCanvasBundle,
  prefetchSessionCanvasBundle,
  useSessionCanvas,
} from "@/hooks/use-session-canvas";
import { watchJob } from "@/lib/job-stream";
import { consumePendingAssets, type PendingAsset } from "@/lib/pending-assets";
import { consumePendingInspiration, normalizePendingInspiration } from "@/lib/pending-inspiration";
import { expandFromDirection } from "@/lib/expand-extend";
import {
  paddingToExtend,
  type ExpandAspectPreset,
} from "@/lib/expand-frame";
import { focusIndexLabel } from "@/lib/focus-index-labels";
import { resolveToolResolution } from "@/lib/tool-resolution";
import { formatToolProviderLabel } from "@/lib/studio-tool-meta";
import { hapticLight } from "@/lib/haptics";
import { type SessionKind } from "@/lib/session-kind";
import { buildStudioUrl, studioUrlForSession } from "@/lib/studio-navigation";
import { useIsMobile } from "@/hooks/use-is-mobile";

type SelectionToolInteraction =
  | "direct"
  | "brush"
  | "prompt"
  | "click"
  | "expand-frame";

const TOOL_INTERACTIONS: Record<string, SelectionToolInteraction> = {
  cutout: "direct",
  upscale: "direct",
  enhance: "direct",
  variation: "direct",
  erase: "brush",
  inpaint: "brush",
  "focus-edit": "click",
  expand: "expand-frame",
  text: "prompt",
  blend: "prompt",
};

const FOCUS_CLICK_DEBOUNCE_MS = 1500;

function getToolInteraction(toolId: string): SelectionToolInteraction {
  return TOOL_INTERACTIONS[toolId] ?? "prompt";
}

function buildToolPromptSuffix(tool: StudioTool): string {
  switch (tool.id) {
    case "erase":
      return "请处理局部区域：去掉/清理 ";
    case "inpaint":
      return "请局部重绘：把指定区域改成 ";
    case "expand":
      return "请扩展画面，方向和要求是：";
    case "text":
      return "请修改图片文字为：";
    case "blend":
      return "请与另一个 @ 图片融合，要求是：";
    case "focus-edit":
      return tool.defaultPrompt;
    default:
      return `${tool.defaultPrompt}，要求是：`;
  }
}

/** Studio 侧栏会话列表：拉取上限（API 按 updated_at 降序） */
const STUDIO_SIDEBAR_SESSION_LIMIT = 200;

interface StudioWorkspaceProps {
  sessionId: string;
  initialMode: CreationMode;
  initialPrompt: string;
  initialTitle?: string;
  initialKind?: SessionKind;
  initialJobId?: string;
  initialToolId?: string;
}

export function StudioWorkspace({
  sessionId,
  initialMode,
  initialPrompt,
  initialTitle,
  initialKind,
  initialJobId,
  initialToolId,
}: StudioWorkspaceProps) {
  const router = useRouter();
  const mobile = useIsMobile(MOBILE_BREAKPOINT);
  const compactLayout = useIsMobile(1024);
  const canvasRef = useRef<DesignCanvasHandle>(null);
  const prevItemCountRef = useRef(0);
  const canvasItemsRef = useRef<CanvasItem[]>([]);
  const loadCanvasRef = useRef<
    (opts?: { force?: boolean }) => Promise<void>
  >(async () => {});
  const handleJobCompleteRef = useRef<
    (completedJobId?: string) => Promise<void>
  >(async () => {});
  const completingJobIdRef = useRef<string | null>(null);
  const { user, loading: authLoading, refreshUser } = useAuth();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(false);
  const [dockMode, setDockMode] = useState<StudioDockMode>("expanded");
  const [workspaceWidth, setWorkspaceWidth] = useState(264);
  const [isDraggingWorkspace, setIsDraggingWorkspace] = useState(false);
  const [restoredAssets, setRestoredAssets] = useState<PendingAsset[]>([]);
  const [inspirationApply, setInspirationApply] =
    useState<StudioInspirationApply | null>(null);
  const [selectSourceBanner, setSelectSourceBanner] = useState<string | null>(
    null,
  );
  const [jobFailed, setJobFailed] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);
  const [jobFailedToolType, setJobFailedToolType] = useState<string | null>(
    null,
  );

  const dismissJobFailure = useCallback(() => {
    setJobFailed(false);
    setJobError(null);
    setJobFailedToolType(null);
    setSelectSourceBanner(null);
  }, []);

  const [mode, setMode] = useState<CreationMode>(initialMode);
  const [selectedCanvasId, setSelectedCanvasId] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);


  useEffect(() => {
    const saved = readStudioDockMode();
    setDockMode(saved ?? defaultStudioDockMode(compactLayout));
  }, [compactLayout]);

  useEffect(() => {
    persistStudioDockMode(dockMode);
  }, [dockMode]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "j") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      setDockMode((prev) => (prev === "focus" ? "expanded" : "focus"));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!user) return;
    void trackEvent("studio_open", { sessionId, mode });
  }, [user, sessionId, mode]);

  const {
    items: canvasItems,
    setItems: setCanvasItems,
    load: loadCanvas,
    registerBatchLineage,
    canEdit: canvasCanEdit,
    setCanEdit,
  } = useSessionCanvas(sessionId, Boolean(user), { autoLoad: false });
  loadCanvasRef.current = loadCanvas;
  canvasItemsRef.current = canvasItems;
  const [sessions, setSessions] = useState<ImageSession[]>([]);
  const [tools, setTools] = useState<StudioTool[]>([]);
  const [ready, setReady] = useState(false);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [jobStreamStatus, setJobStreamStatus] = useState<string | null>(null);
  const [jobProgressCompleted, setJobProgressCompleted] = useState(0);
  const [jobProgressTotal, setJobProgressTotal] = useState(0);
  const [jobStartedAt, setJobStartedAt] = useState<number | null>(null);
  const [queueAhead, setQueueAhead] = useState<number | null>(null);
  const [, setJobTick] = useState(0);
  const [studioPrompt, setStudioPrompt] = useState(initialPrompt);
  const lastOutputCountRef = useRef(0);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    null,
  );
  const [pendingToolId, setPendingToolId] = useState<string | null>(null);
  const [mentionItemRequest, setMentionItemRequest] = useState<{
    key: number;
    item: CanvasItem;
    promptSuffix?: string;
    maskSelection?: CanvasMaskSelection;
  } | null>(null);
  const [brushRequest, setBrushRequest] = useState<{
    key: number;
    itemId: string;
    toolId: string;
    toolName: string;
    promptExtra?: string;
  } | null>(null);
  const [expandRequest, setExpandRequest] = useState<{
    key: number;
    itemId: string;
    toolName: string;
    promptExtra?: string;
    aspectPreset?: ExpandAspectPreset;
  } | null>(null);
  const [focusEditSession, setFocusEditSession] =
    useState<FocusEditSession | null>(null);
  const [focusRecognizing, setFocusRecognizing] = useState(false);

  useEffect(() => {
    if (!focusEditSession) return;
    setDockMode((prev) => (prev === "focus" ? "expanded" : prev));
  }, [focusEditSession]);

  const [focusClickKey, setFocusClickKey] = useState(0);
  const lastFocusClickAtRef = useRef(0);
  /** 受控的内容举报对话框（StudioHeader 右上 ⚠ 触发） */
  const [reportOpen, setReportOpen] = useState(false);
  const [toolConfirm, setToolConfirm] = useState<ToolConfirmRequest | null>(
    null,
  );
  const [toolConfirmPending, setToolConfirmPending] = useState(false);

  const handleWorkspaceChange = useCallback((id: string) => {
    setActiveWorkspaceId(id);
    void listSessions(STUDIO_SIDEBAR_SESSION_LIMIT, undefined, id).then(
      setSessions,
    );
  }, []);

  useEffect(() => {
    if (!user || sessions.length === 0) return;
    for (const s of sessions.slice(0, 8)) {
      if (s.id !== sessionId) prefetchSessionCanvasBundle(s.id);
    }
  }, [sessions, sessionId, user]);

  const handleWorkspaceDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingWorkspace(true);
  }, []);

  const handleWorkspaceDrag = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingWorkspace) return;
      const newWidth = Math.max(200, Math.min(400, e.clientX));
      setWorkspaceWidth(newWidth);
    },
    [isDraggingWorkspace],
  );

  const handleWorkspaceDragEnd = useCallback(() => {
    setIsDraggingWorkspace(false);
  }, []);

  useEffect(() => {
    if (isDraggingWorkspace) {
      window.addEventListener("mousemove", handleWorkspaceDrag);
      window.addEventListener("mouseup", handleWorkspaceDragEnd);
      return () => {
        window.removeEventListener("mousemove", handleWorkspaceDrag);
        window.removeEventListener("mouseup", handleWorkspaceDragEnd);
      };
    }
  }, [isDraggingWorkspace, handleWorkspaceDrag, handleWorkspaceDragEnd]);

  const currentSession = sessions.find((s) => s.id === sessionId);
  const canEditSession = currentSession?.can_edit ?? canvasCanEdit;
  const readOnly = Boolean(user && !canEditSession);
  const sessionKind: SessionKind =
    currentSession?.kind ?? initialKind ?? "canvas";
  const sessionTitle =
    currentSession?.title && currentSession.title !== "未命名"
      ? currentSession.title
      : initialTitle ?? (mode === "ecommerce" ? "电商套图" : "未命名");

  const initSession = useCallback(async () => {
    if (!user) return;
    const pending = consumePendingAssets(sessionId);
    if (pending.length) setRestoredAssets(pending);

    const pendingRaw = consumePendingInspiration(sessionId);
    const pendingInspiration = pendingRaw
      ? normalizePendingInspiration(pendingRaw)
      : null;
    if (pendingInspiration) {
      persistCreationLane("studio", pendingInspiration.creationLane);
      setInspirationApply({
        ...pendingInspiration,
        aspectRatio: coerceInspirationAspect(pendingInspiration.aspectRatio),
        applyKey: 1,
      });
    }

    const wsId = activeWorkspaceId ?? getActiveWorkspaceId() ?? undefined;
    const ensured = await ensureSession(sessionId, mode, {
      title: initialTitle ?? pendingInspiration?.title,
      kind:
        pendingInspiration ?
          pendingInspiration.creationLane === "video" ?
            "canvas"
          : "project"
        : (initialKind ?? "canvas"),
      workspaceId: wsId,
      sourceInspirationId: pendingInspiration?.id,
    });
    setCanEdit(ensured.can_edit ?? true);
    /**
     * 刷新恢复灵感注入：无 pendingInspiration 时，用 ensure 返回的 sourceInspiration
     * 重建 inspirationApply，以便 CreationPanel 继续预填 prompt / 参考图。
     */
    if (!pendingInspiration && ensured.sourceInspiration) {
      const src = ensured.sourceInspiration;
      const normalized = normalizePendingInspiration({
        id: src.id,
        title: src.title,
        prompt: src.prompt,
        modelId: src.modelId,
        aspectRatio: coerceInspirationAspect(src.aspectRatio),
        resolution: src.resolution,
        variables: src.variables,
        variableValues: src.variableValues ?? {},
        referenceUrls: src.referenceUrls ?? [],
        creationLane: src.mediaType === "video" ? "video" : undefined,
      });
      persistCreationLane("studio", normalized.creationLane);
      setInspirationApply({
        ...normalized,
        aspectRatio: coerceInspirationAspect(normalized.aspectRatio),
        applyKey: 1,
      });
    }
    const listPromise = listSessions(
      STUDIO_SIDEBAR_SESSION_LIMIT,
      undefined,
      wsId,
    );
    const toolsPromise = fetchTools().catch(() => []);

    await loadCanvas();
    if (pendingInspiration?.referenceUrls.length) {
      const refItems = await importInspirationReferencesToCanvas(
        sessionId,
        pendingInspiration.referenceUrls,
      );
      setCanvasItems((prev) => [...prev, ...refItems]);
      if (refItems[0]) setSelectedCanvasId(refItems[0].id);
    }
    setReady(true);
    const [list, toolList] = await Promise.all([listPromise, toolsPromise]);
    setSessions(list);
    setTools(toolList);
  }, [
    user,
    sessionId,
    mode,
    initialTitle,
    initialKind,
    loadCanvas,
    setCanvasItems,
    activeWorkspaceId,
    setCanEdit,
  ]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setReady(true);
      fetchTools().then(setTools).catch(() => setTools([]));
      return;
    }
    const stored = getActiveWorkspaceId();
    if (stored) setActiveWorkspaceId(stored);
    initSession().catch(() => setReady(true));
  }, [authLoading, user, initSession]);

  useEffect(() => {
    if (!initialJobId || !user) return;
    let cancelled = false;
    void fetchJob(initialJobId)
      .then((job) => {
        if (cancelled) return;
        if (job.status === "succeeded" || job.status === "failed") {
          setPollingJobId(null);
          setJobStreamStatus(null);
          void loadCanvasRef.current({ force: true });
          if (job.status === "failed") {
            setJobFailed(true);
            setJobError(job.error ?? null);
            setJobFailedToolType(job.tool_type ?? null);
            const friendly = formatJobErrorMessage(job.error, {
              toolType: job.tool_type,
            });
            setSelectSourceBanner(
              friendly ?? job.error ?? "生成失败，积分已退回",
            );
          }
          router.replace(
            `/studio?sessionId=${encodeURIComponent(sessionId)}&mode=${mode}`,
          );
          return;
        }
        setPollingJobId(initialJobId);
      })
      .catch(() => {
        if (!cancelled) setPollingJobId(initialJobId);
      });
    return () => {
      cancelled = true;
    };
  }, [initialJobId, user, sessionId, mode, router]);

  useEffect(() => {
    if (!initialToolId || !tools.length) return;
    const tool = tools.find((t) => t.id === initialToolId);
    if (!tool) return;
    if (tool.requiresSource) {
      setSelectSourceBanner(`请先在画布点选一张图片，再运行 ${tool.name}`);
    }
  }, [initialToolId, tools]);

  const registerToolBatchLineage = useCallback(
    (jobId: string, item: CanvasItem, toolName?: string) => {
      registerBatchLineage(jobId, {
        parentBatchId: item.batchId,
        sourceItemId: item.id,
        sourceOutputId: item.outputId,
        toolName,
      });
    },
    [registerBatchLineage],
  );

  const handleJobStarted = useCallback(
    (jobId: string, lineage?: PendingBatchLineage) => {
      if (lineage) registerBatchLineage(jobId, lineage);
      if (canvasRef.current?.isInRefineMode()) {
        canvasRef.current.beginRefineJob();
      } else {
        setSelectedCanvasId(null);
      }
      setPollingJobId(jobId);
    },
    [registerBatchLineage],
  );

  /** 仅滚动/高亮最新批次，不写入 selectedCanvasId（避免误绑定图生图参考） */
  const scrollToLatestCanvasBatch = useCallback(() => {
    const target = pickLatestBatchFocusTarget(canvasItemsRef.current);
    if (!target) return;
    if (target.batchId) {
      canvasRef.current?.fitToBatch(target.batchId);
    } else {
      canvasRef.current?.fitToItem(target.itemId);
    }
    canvasRef.current?.pulseItem(target.itemId);
  }, []);

  const handleJumpToParentBatch = useCallback(
    (parentBatchId: string, sourceItemId?: string) => {
      canvasRef.current?.fitToBatch(parentBatchId);
      if (sourceItemId) {
        setSelectedCanvasId(sourceItemId);
        canvasRef.current?.pulseItem(sourceItemId);
      }
    },
    [],
  );

  const handleJobComplete = useCallback(async (completedJobId?: string) => {
    if (
      completedJobId &&
      completingJobIdRef.current === completedJobId
    ) {
      return;
    }
    if (completedJobId) completingJobIdRef.current = completedJobId;
    try {
    invalidateSessionCanvasBundle(sessionId);
    let jobStatus: string | undefined;
    let toolType: string | undefined;
    let failedJobError: string | null = null;
    if (completedJobId) {
      try {
        const job = await fetchJob(completedJobId);
        jobStatus = job.status;
        toolType = job.tool_type ?? undefined;
        if (job.status === "failed") {
          failedJobError = job.error ?? null;
        }
        if (
          job.tool_type &&
          job.status === "succeeded" &&
          !canvasRef.current?.isInRefineMode()
        ) {
          const provider = formatToolProviderLabel(job.image_provider);
          if (provider) {
            setSelectSourceBanner(`精修完成 · ${provider}`);
          }
        }
      } catch {
        /* 忽略 provider 展示失败 */
      }
    }
    await loadCanvas({ force: true });
    await refreshUser();
    setSessions(
      await listSessions(
        STUDIO_SIDEBAR_SESSION_LIMIT,
        undefined,
        activeWorkspaceId ?? undefined,
      ),
    );
    if (jobStatus === "failed") {
      setJobFailed(true);
      setJobError(failedJobError);
      setJobFailedToolType(toolType ?? null);
      const friendly = formatJobErrorMessage(failedJobError, {
        toolType,
      });
      setSelectSourceBanner(
        friendly ?? failedJobError ?? "生成失败，积分已退回",
      );
    } else if (jobStatus === "succeeded") {
      setJobFailed(false);
      setJobError(null);
      setJobFailedToolType(null);
    }
    setPollingJobId(null);
    setJobStreamStatus(null);
    setJobProgressCompleted(0);
    setJobProgressTotal(0);
    setJobStartedAt(null);
    setQueueAhead(null);
    lastOutputCountRef.current = 0;
    router.replace(
      `/studio?sessionId=${encodeURIComponent(sessionId)}&mode=${mode}`,
    );
    if (canvasRef.current?.isInRefineMode()) {
      if (jobStatus === "succeeded") {
        canvasRef.current.completeRefineJob({ toolName: toolType });
      } else {
        canvasRef.current.cancelRefineJob();
      }
    } else {
      setSelectedCanvasId(null);
      window.requestAnimationFrame(() => scrollToLatestCanvasBatch());
    }
    } finally {
      if (completedJobId && completingJobIdRef.current === completedJobId) {
        completingJobIdRef.current = null;
      }
    }
  }, [
    loadCanvas,
    refreshUser,
    activeWorkspaceId,
    scrollToLatestCanvasBatch,
    router,
    sessionId,
    mode,
  ]);

  handleJobCompleteRef.current = handleJobComplete;

  useEffect(() => {
    if (!pollingJobId || !user) return;
    const t0 = performance.now();
    const jobId = pollingJobId;
    let cancelled = false;

    void fetchJob(jobId)
      .then((job) => {
        if (cancelled) return;
        setJobStreamStatus(job.status);
        if (job.count) setJobProgressTotal(job.count);
        setQueueAhead(job.queue_ahead ?? null);
        if (job.status === "succeeded" || job.status === "failed") {
          if (job.status === "failed") {
            setJobFailed(true);
            setJobError(job.error ?? null);
          }
          void handleJobCompleteRef.current(jobId);
        }
      })
      .catch(() => {
        if (!cancelled) setJobStreamStatus("queued");
      });

    setJobFailed(false);
    setJobError(null);
    setJobFailedToolType(null);
    setJobProgressCompleted(0);
    setJobStartedAt(Date.now());
    lastOutputCountRef.current = 0;
    const tickTimer = window.setInterval(() => setJobTick((n) => n + 1), 1000);
    const stop = watchJob(
      jobId,
      (ev) => {
        setJobStreamStatus(ev.status);
        if (ev.count) setJobProgressTotal(ev.count);
        if (ev.queueAhead !== undefined) setQueueAhead(ev.queueAhead);
        if (typeof ev.completed === "number") {
          setJobProgressCompleted(ev.completed);
          if (
            ev.status === "running" &&
            ev.completed > lastOutputCountRef.current
          ) {
            lastOutputCountRef.current = ev.completed;
            void loadCanvasRef.current({ force: true });
          }
        }
        if (ev.status === "failed") {
          setJobFailed(true);
          setJobError(ev.error ?? null);
        }
      },
      () => {
        void handleJobCompleteRef.current(jobId);
      },
      () => {
        void trackEvent("generation_fail", {
          job_id: jobId,
          error_code: "STREAM_ERROR",
          duration_ms: Math.round(performance.now() - t0),
        });
        setJobFailed(true);
        setJobError("任务连接中断，请重试");
        setPollingJobId(null);
        setJobStreamStatus("failed");
      },
    );
    return () => {
      cancelled = true;
      window.clearInterval(tickTimer);
      stop();
    };
  }, [pollingJobId, user]);

  const jobElapsedMs =
    jobStartedAt != null ? Date.now() - jobStartedAt : undefined;

  useEffect(() => {
    const count = canvasItems.length;
    if (count > prevItemCountRef.current && pollingJobId) {
      scrollToLatestCanvasBatch();
    }
    prevItemCountRef.current = count;
  }, [canvasItems.length, pollingJobId, scrollToLatestCanvasBatch]);

  function handleQuickToolFromCanvas(
    item: CanvasItem,
    toolId: "cutout" | "expand",
  ) {
    const tool = tools.find((t) => t.id === toolId);
    if (!tool) return;
    void handleRunSelectionTool(tool, item);
  }

  /**
   * 选中画布图片后，从浮层 AI 工具栏一键跑工具。
   * - 优先 outputId（已生成图）；其次 assetId（上传图）。
   * - clientOnly 工具（如 crop）不在浮层显示，由画布原生工具栏承担。
   */
  function exitFocusEditMode() {
    setFocusEditSession(null);
    setFocusRecognizing(false);
    setFocusClickKey((k) => k + 1);
  }

  function startFocusEditMode(
    item: CanvasItem,
    opts?: { intent?: "edit" | "replace"; promptHint?: string },
  ) {
    setBrushRequest(null);
    setFocusEditSession({
      itemId: item.id,
      points: [],
      intent: opts?.intent ?? "edit",
      cropSize: DEFAULT_CROP_SIZE,
    });
    setFocusClickKey((k) => k + 1);
    setSelectedCanvasId(item.id);
    if (opts?.promptHint) {
      setMentionItemRequest((prev) => ({
        key: (prev?.key ?? 0) + 1,
        item,
        promptSuffix: opts.promptHint,
      }));
    }
    setSelectSourceBanner(
      "焦点编辑：在图片上点击要修改的位置，在工作站输入短 prompt 后提交。",
    );
    hapticLight();
  }

  const handleFocusImageClick = useCallback(
    async (item: CanvasItem, point: { x: number; y: number }) => {
      if (!user || readOnly || !focusEditSession || item.id !== focusEditSession.itemId) {
        return;
      }
      const now = Date.now();
      if (now - lastFocusClickAtRef.current < FOCUS_CLICK_DEBOUNCE_MS) {
        setSelectSourceBanner("点击过快，请稍候再添加焦点");
        return;
      }
      lastFocusClickAtRef.current = now;
      if (focusEditSession.points.length >= MAX_FOCUS_POINTS) {
        setSelectSourceBanner(`最多添加 ${MAX_FOCUS_POINTS} 个焦点`);
        return;
      }
      setFocusRecognizing(true);
      try {
        const imageUrl = assetUrl(item.url);
        const data = await recognizeFocusPoint({
          sessionId,
          imageUrl,
          x: point.x,
          y: point.y,
          cropSize: focusEditSession.cropSize,
        });
        const chip: FocusPointChip = {
          pointId: data.pointId,
          objectName: data.objectName?.trim() || "目标区域",
          x: point.x,
          y: point.y,
          itemId: item.id,
        };
        setFocusEditSession((prev) =>
          prev && prev.itemId === item.id
            ? { ...prev, points: [...prev.points, chip] }
            : prev,
        );
        setSelectSourceBanner(null);
        hapticLight();
      } catch (err) {
        setSelectSourceBanner(
          err instanceof Error ? err.message : "焦点识别失败",
        );
      } finally {
        setFocusRecognizing(false);
      }
    },
    [user, readOnly, focusEditSession, sessionId],
  );

  async function executeDirectTool(
    tool: StudioTool,
    item: CanvasItem,
    opts: ToolConfirmOptions,
  ) {
    const referenceOutputIds = item.outputId ? [item.outputId] : undefined;
    const assetIds =
      !referenceOutputIds && item.assetId ? [item.assetId] : undefined;
    setPendingToolId(tool.id);
    try {
      const userPrompt = opts.prompt?.trim();
      const prompt =
        userPrompt || tool.defaultPrompt;
      const { jobId } = await runTool(tool.id, {
        sessionId,
        prompt,
        referenceOutputIds,
        assetIds,
        resolution: resolveToolResolution(tool.id),
        aspectRatio: tool.id === "expand" ? "auto" : undefined,
        count: tool.id === "variation" ? opts.count : 1,
        ...(tool.id === "upscale"
          ? { scale: opts.scale ?? ("2x" as const) }
          : {}),
        ...(tool.id === "expand"
          ? {
              extend:
                opts.expandExtend ??
                expandFromDirection(opts.expandDirection),
            }
          : {}),
      });
      void trackEvent("tool_run", {
        tool_id: tool.id,
        job_id: jobId,
        has_reference: true,
        count: tool.id === "variation" ? opts.count : 1,
      });
      registerToolBatchLineage(jobId, item, tool.name);
      if (canvasRef.current?.isInRefineMode()) {
        canvasRef.current.beginRefineJob();
      }
      setPollingJobId(jobId);
      setSelectSourceBanner(null);
    } catch (err) {
      setSelectSourceBanner(
        err instanceof Error ? err.message : "工具执行失败",
      );
    } finally {
      setPendingToolId(null);
    }
  }

  async function handleToolConfirm(opts: ToolConfirmOptions) {
    if (!toolConfirm) return;
    const { tool, item } = toolConfirm;
    const interaction = getToolInteraction(tool.id);

    if (interaction === "brush") {
      setToolConfirm(null);
      setExpandRequest(null);
      setBrushRequest({
        key: Date.now(),
        itemId: item.id,
        toolId: tool.id,
        toolName: tool.name,
        promptExtra:
          tool.id === "erase" ? opts.prompt?.trim() || undefined : undefined,
      });
      setSelectSourceBanner(
        tool.id === "inpaint"
          ? `${tool.name}：请先用画笔圈选区域，完成后再在工作台填写修改提示词。`
          : `${tool.name}：请在图片上涂抹要处理的区域（可调节画笔粗细）。`,
      );
      hapticLight();
      return;
    }

    if (interaction === "expand-frame") {
      setToolConfirm(null);
      setBrushRequest(null);
      setExpandRequest({
        key: Date.now(),
        itemId: item.id,
        toolName: tool.name,
        promptExtra: opts.prompt?.trim() || undefined,
        aspectPreset: opts.expandAspectPreset,
      });
      setSelectSourceBanner(
        `${tool.name}：拖拽外框四角或四边调整扩图范围，可选比例后确认。`,
      );
      hapticLight();
      return;
    }

    if (interaction === "click") {
      setToolConfirm(null);
      const suffix = opts.prompt?.trim()
        ? `${buildToolPromptSuffix(tool)}${opts.prompt.trim()}`
        : buildToolPromptSuffix(tool);
      startFocusEditMode(item, {
        intent: opts.intent,
        promptHint: suffix,
      });
      return;
    }

    if (interaction === "prompt") {
      if (tool.id === "blend") {
        setToolConfirm(null);
        const suffix = opts.prompt?.trim()
          ? `${buildToolPromptSuffix(tool)}${opts.prompt.trim()}`
          : buildToolPromptSuffix(tool);
        setMentionItemRequest((prev) => ({
          key: (prev?.key ?? 0) + 1,
          item,
          promptSuffix: suffix,
        }));
        setSelectSourceBanner(
          `${tool.name}：已把当前图 @ 到工作台，请再 @ 另一张素材并提交。`,
        );
        hapticLight();
        return;
      }
    }

    setToolConfirmPending(true);
    try {
      await executeDirectTool(tool, item, opts);
      setToolConfirm(null);
    } finally {
      setToolConfirmPending(false);
    }
  }

  async function handleRunSelectionTool(
    tool: StudioTool,
    item: CanvasItem,
  ) {
    if (!user) {
      setLoginOpen(true);
      return;
    }
    if (readOnly || tool.clientOnly) return;
    setSelectedCanvasId(item.id);
    const referenceOutputIds = item.outputId ? [item.outputId] : undefined;
    const assetIds =
      !referenceOutputIds && item.assetId ? [item.assetId] : undefined;
    if (tool.requiresSource && !referenceOutputIds && !assetIds) {
      setSelectSourceBanner("请先在画布点选一张已生成的图片");
      return;
    }

    setToolConfirm({ tool, item });
    hapticLight();
  }

  async function handleCanvasDownload() {
    const selected = canvasItems.find((i) => i.id === selectedCanvasId);
    if (selected) {
      window.open(assetUrl(selected.url), "_blank");
      return;
    }
    if (!user) {
      setLoginOpen(true);
      return;
    }
    const data = await exportSession(sessionId);
    for (const f of data.files) {
      window.open(
        f.url.startsWith("http") ? f.url : `${resolveApiBase()}${f.url}`,
        "_blank",
      );
    }
    if (!data.files.length) setSelectSourceBanner("暂无可下载内容");
  }

  function handleCanvasUpload() {
    if (!user) {
      setLoginOpen(true);
      return;
    }
    if (readOnly) return;
    uploadRef.current?.click();
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user || readOnly) return;
    try {
      await ensureSession(sessionId, mode);
      const { id, url, thumbUrl } = await uploadAsset(file, sessionId);
      setCanvasItems((prev) => [
        ...prev,
        createUploadCanvasItem(url, prev, {
          assetId: id,
          role: "product",
          thumbUrl,
        }),
      ]);
      hapticLight();
    } catch (err) {
      setSelectSourceBanner(
        err instanceof Error ? err.message : "上传失败",
      );
    }
  }

  function handleUploadToCanvas(assetId: string, url: string, thumbUrl?: string) {
    if (readOnly) return;
    setCanvasItems((prev) => [
      ...prev,
      createUploadCanvasItem(url, prev, { assetId, role: "product", thumbUrl }),
    ]);
    hapticLight();
  }

  function handleDeleteCanvasItem() {
    if (readOnly || !selectedCanvasId) return;
    setCanvasItems((prev) => prev.filter((i) => i.id !== selectedCanvasId));
    setSelectedCanvasId(null);
  }

  async function handleRerun(item: CanvasItem) {
    if (!user) {
      setLoginOpen(true);
      return;
    }
    if (readOnly || !item.generationParams) {
      setSelectSourceBanner("此图片无法重跑：缺少原始生成参数");
      return;
    }

    const params = item.generationParams;
    setSelectSourceBanner("正在重跑任务...");

    try {
      let jobId: string;
      
      if (params.toolType) {
        const { jobId: id } = await runTool(params.toolType, {
          sessionId,
          prompt: params.prompt,
          resolution: params.resolution,
          referenceOutputIds: item.outputId ? [item.outputId] : undefined,
        });
        jobId = id;
        void trackEvent("tool_run", {
          tool_id: params.toolType,
          job_id: jobId,
          has_reference: Boolean(item.outputId),
        });
        registerToolBatchLineage(jobId, item, params.toolType);
      } else {
        const { jobId: id } = await submitGeneration({
          sessionId,
          prompt: params.prompt,
          modelId: params.modelId,
          count: params.count ?? 1,
          resolution: params.resolution ?? "standard",
          aspectRatio: params.aspectRatio,
          mode: params.toolType ? "chat" : mode,
        });
        jobId = id;
        void trackEvent("generation_rerun", {
          job_id: jobId,
          model_id: params.modelId ?? "unknown",
        });
      }
      
      setPollingJobId(jobId);
      setSelectSourceBanner(null);
    } catch (err) {
      setSelectSourceBanner(
        err instanceof Error ? err.message : "重跑失败",
      );
    }
  }

  async function handleCancelJob() {
    if (!pollingJobId || !user) return;
    
    try {
      const result = await cancelJob(pollingJobId);
      setPollingJobId(null);
      setJobStreamStatus(null);
      setJobProgressCompleted(0);
      setJobProgressTotal(0);
      setJobStartedAt(null);
      setQueueAhead(null);
      setSelectSourceBanner(`任务已取消，积分已退回（${result.refundedPoints}积分）`);
      await refreshUser();
      await loadCanvas({ force: true });
    } catch (err) {
      setSelectSourceBanner(
        err instanceof Error ? err.message : "取消任务失败",
      );
    }
  }

  const handleTitleSaved = useCallback((title: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title } : s)),
    );
  }, [sessionId]);

  const handleSessionDeleted = useCallback(
    (deletedId?: string) => {
      const id = deletedId ?? sessionId;
      void listSessions(
        STUDIO_SIDEBAR_SESSION_LIMIT,
        undefined,
        activeWorkspaceId ?? undefined,
      ).then(setSessions);
      if (id === sessionId) {
        router.push(buildStudioUrl("canvas", { mode }));
      }
    },
    [sessionId, mode, router, activeWorkspaceId],
  );

  const selectedCanvasItem =
    selectedCanvasId ?
      (canvasItems.find((i) => i.id === selectedCanvasId) ?? null)
    : null;

  const focusClickRequest =
    focusEditSession
      ? {
          key: focusClickKey,
          itemId: focusEditSession.itemId,
          toolName: "焦点编辑",
          markers: focusEditSession.points.map((p) => ({
            x: p.x,
            y: p.y,
            label: p.objectName,
          })),
        }
      : null;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.repeat || e.shiftKey || e.altKey) return;
      if (e.key !== "Control" && e.key !== "Meta") return;
      e.preventDefault();
      if (readOnly || !user) return;
      const item =
        selectedCanvasItem ??
        (() => {
          const t = pickLatestBatchFocusTarget(canvasItems);
          return t ? canvasItems.find((i) => i.id === t.itemId) : null;
        })();
      if (!item?.outputId && !item?.assetId) {
        setSelectSourceBanner("请先在画布点选一张图片，再开启焦点编辑");
        return;
      }
      if (focusEditSession?.itemId === item.id) {
        exitFocusEditMode();
        setSelectSourceBanner(null);
      } else {
        startFocusEditMode(item);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    user,
    readOnly,
    selectedCanvasItem,
    canvasItems,
    focusEditSession?.itemId,
  ]);

  /** 桌面端侧栏展开时隐藏顶栏，把画布纵向空间还给创作区 */
  const showTopBar = mobile || workspaceCollapsed;

  return (
    <WorkspaceProvider onWorkspaceChange={handleWorkspaceChange}>
      {showTopBar ? (
        <StudioHeader
          sessionId={user ? sessionId : undefined}
          sessionTitle={sessionTitle}
          sessionKind={sessionKind}
          sessionReadOnly={readOnly}
          onMenuClick={() => setSidebarOpen(true)}
          onTitleSaved={handleTitleSaved}
          onSessionDeleted={() => handleSessionDeleted()}
          onReportClick={user ? () => setReportOpen(true) : undefined}
          variant="minimal"
          showAccountActions={mobile || workspaceCollapsed}
        />
      ) : null}

      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onFileSelected(e)}
        aria-label="上传图片"
      />

      <StudioCoach />

      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            aria-label="关闭侧栏"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <aside
          style={
            workspaceCollapsed ? undefined : { width: workspaceWidth }
          }
          className={`fixed bottom-0 left-0 z-50 flex min-h-0 w-[min(85vw,280px)] flex-col border-r border-white/5 bg-[#080808] p-3 transition-all ${
            showTopBar ? "top-12" : "top-0"
          } ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } ${
            workspaceCollapsed
              ? "lg:hidden"
              : "lg:static lg:top-auto lg:z-0 lg:m-2 lg:mr-0 lg:w-auto lg:translate-x-0 lg:rounded-2xl lg:border lg:bg-[#090909]/95"
          }`}
        >
          <div className="mb-2 flex items-center justify-between lg:hidden">
            <span className="text-xs font-medium text-zinc-500">工作区</span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-1 text-zinc-500 hover:text-white"
              title="关闭侧栏"
            >
              <X className="size-4" />
            </button>
          </div>

          <Link
            href="/"
            onClick={() => setSidebarOpen(false)}
            className="mb-3 hidden items-center rounded-lg px-1 py-0.5 transition hover:bg-white/5 lg:flex"
            title="返回首页"
            aria-label="返回首页"
          >
            <BrandLogo variant="mark" markSize="sm" />
          </Link>

          {!workspaceCollapsed ? (
            <button
              type="button"
              onClick={() => setWorkspaceCollapsed(true)}
              className="mb-2 hidden size-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300 lg:flex"
              aria-label="收起工作区"
              title="收起工作区"
            >
              <ChevronLeft className="size-3.5" strokeWidth={1.75} />
            </button>
          ) : null}

          {!workspaceCollapsed && user && sessionId ? (
            <div className="mb-3 hidden border-b border-white/5 pb-3 lg:block">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <SessionTitleActions
                    sessionId={sessionId}
                    title={sessionTitle}
                    variant="header"
                    disabled={readOnly}
                    onTitleSaved={handleTitleSaved}
                    onDeleted={() => handleSessionDeleted()}
                  />
                  <div className="mt-1 flex items-center gap-2">
                    {sessionKind === "project" ? (
                      <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[9px] font-medium text-purple-300">
                        项目
                      </span>
                    ) : null}
                    <span className="text-[10px] text-zinc-600">
                      内容由 AI 生成
                    </span>
                  </div>
                </div>
                {!readOnly ? (
                  <button
                    type="button"
                    onClick={() => setReportOpen(true)}
                    className="shrink-0 rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-amber-300"
                    aria-label="举报违规内容"
                    title="举报违规内容"
                  >
                    <Flag className="size-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                router.push(buildStudioUrl("canvas"));
              }}
              className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-black transition hover:bg-zinc-200"
            >
              <Plus className="size-3.5" />
              新建
            </button>
          </div>

          {user ? (
            <WorkspaceSwitcher onWorkspaceChange={handleWorkspaceChange} />
          ) : null}

          <div className="mt-4 flex shrink-0 items-center justify-between">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
              画布历史
            </p>
            <Link
              href={
                sessionId
                  ? `/projects?from=studio&sessionId=${encodeURIComponent(sessionId)}&mode=${mode}&kind=${sessionKind}`
                  : "/projects?from=studio"
              }
              onClick={() => setSidebarOpen(false)}
              className="text-[10px] text-zinc-500 hover:text-orange-400"
            >
              查看全部
            </Link>
          </div>
          <ul className="mt-2 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain">
            {sessions.map((s) => (
              <li key={s.id} className="group">
                <Link
                  href={studioUrlForSession({
                    id: s.id,
                    mode: s.mode,
                    kind: s.kind,
                  })}
                  onMouseEnter={() => prefetchSessionCanvasBundle(s.id)}
                  onFocus={() => prefetchSessionCanvasBundle(s.id)}
                  onClick={() => setSidebarOpen(false)}
                  className={`block rounded-lg px-3 py-2 text-sm transition ${
                    s.id === sessionId
                      ? "bg-white/10 text-white"
                      : "text-zinc-500 hover:bg-white/5"
                  }`}
                >
                  <SessionTitleActions
                    sessionId={s.id}
                    title={s.title}
                    variant="row"
                    disabled={!user || s.can_edit === false}
                    onTitleSaved={(title) => {
                      setSessions((prev) =>
                        prev.map((x) =>
                          x.id === s.id ? { ...x, title } : x,
                        ),
                      );
                    }}
                    onDeleted={() => handleSessionDeleted(s.id)}
                  />
                  <div className="text-[10px] text-zinc-600">
                    画布 · {s.mode}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <div className="shrink-0">
            <StudioWorkspaceFooter onLogin={() => setLoginOpen(true)} />
          </div>
        </aside>

        {!workspaceCollapsed && (
          <div
            onMouseDown={handleWorkspaceDragStart}
            className={`hidden lg:flex w-1 cursor-col-resize items-center justify-center transition-colors hover:bg-orange-500/30 ${
              isDraggingWorkspace ? "bg-orange-500/50" : "bg-transparent"
            }`}
            title="拖拽调整工作区宽度"
          />
        )}

        <div className="relative flex min-h-0 min-w-0 flex-1 gap-0 p-0 lg:gap-0">
          {workspaceCollapsed ? (
            <button
              type="button"
              onClick={() => setWorkspaceCollapsed(false)}
              className="pointer-events-auto absolute left-3 top-3 z-30 hidden size-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300 lg:flex"
              aria-label="展开工作区"
              title="展开工作区"
            >
              <ChevronRight className="size-3.5" strokeWidth={1.75} />
            </button>
          ) : null}
          {workspaceCollapsed ? (
            <StudioWorkspaceFooter
              floating
              onLogin={() => setLoginOpen(true)}
            />
          ) : null}
          <StudioOrchestrationProvider
            sessionId={sessionId}
            mode={mode}
            readOnly={readOnly}
            onJobStarted={handleJobStarted}
            onClearPrompt={() => setStudioPrompt("")}
            onRunSettled={() => {
              void loadCanvas({ force: true });
              void refreshUser();
            }}
          >
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            {readOnly ? (
              <p className="shrink-0 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200/90">
                只读：他人会话，仅创建者或管理员可编辑与生成
              </p>
            ) : null}
            <StudioCanvasWithOrchestration
              ref={canvasRef}
              items={canvasItems}
              onJumpToParentBatch={handleJumpToParentBatch}
              selectedId={selectedCanvasId}
              onSelect={(id) => {
                setSelectedCanvasId(id);
                if (id) {
                  hapticLight();
                  setSelectSourceBanner(null);
                }
              }}
              onItemsChange={setCanvasItems}
              onUpload={handleCanvasUpload}
              onDownload={() => void handleCanvasDownload()}
              onDeleteSelected={handleDeleteCanvasItem}
              onRerun={(item) => void handleRerun(item)}
              emptyHint=""
              scrollBottomInset={studioDockScrollInset(dockMode)}
              readOnly={readOnly}
              jobStreamStatus={jobStreamStatus}
              jobFailed={jobFailed}
              jobErrorMessage={formatJobErrorMessage(jobError, {
                toolType: jobFailedToolType,
              })}
              jobProgressCompleted={jobProgressCompleted}
              jobProgressTotal={jobProgressTotal}
              onCancelJob={handleCancelJob}
              onDismissJobFailure={dismissJobFailure}
              jobElapsedMs={jobElapsedMs}
              queueAhead={queueAhead}
              selectSourceBanner={selectSourceBanner}
              showFailureBannerDismiss={jobFailed}
              onCutoutItem={(item) => handleQuickToolFromCanvas(item, "cutout")}
              onExpandItem={(item) => handleQuickToolFromCanvas(item, "expand")}
              brushRequest={brushRequest}
              focusClickRequest={focusClickRequest}
              onFocusImageClick={(item, point) =>
                void handleFocusImageClick(item, point)
              }
              onFocusClickCancel={() => {
                setSelectSourceBanner(
                  "点选已完成：请在工作站补充 prompt 并提交焦点编辑。",
                );
              }}
              expandRequest={expandRequest}
              onExpandCancel={() => {
                setExpandRequest(null);
                setSelectSourceBanner(null);
              }}
              onExpandComplete={(padding, aspect) => {
                const item = canvasItems.find(
                  (i) => i.id === expandRequest?.itemId,
                );
                const tool = tools.find((t) => t.id === "expand");
                if (!item || !tool) return;
                const extend = paddingToExtend(
                  padding,
                  item.width,
                  item.height,
                );
                const promptExtra = expandRequest?.promptExtra ?? "";
                setExpandRequest(null);
                void executeDirectTool(tool, item, {
                  count: 1,
                  prompt: promptExtra || undefined,
                  expandDirection: undefined,
                  expandExtend: extend,
                  expandAspectPreset: aspect,
                });
              }}
              onBrushCancel={() => {
                setBrushRequest(null);
                setSelectSourceBanner(null);
              }}
              onBrushComplete={(selection) => {
                const item = canvasItems.find((i) => i.id === selection.itemId);
                if (!item) return;
                const tool = tools.find((t) => t.id === selection.toolId);
                const promptExtra = brushRequest?.promptExtra ?? "";
                setBrushRequest(null);
                setMentionItemRequest((prev) => ({
                  key: (prev?.key ?? 0) + 1,
                  item,
                  promptSuffix:
                    buildToolPromptSuffix(
                      tool ?? {
                        id: selection.toolId,
                        name: "局部编辑",
                        description: "",
                        defaultPrompt: "请根据圈选区域进行局部编辑",
                      },
                    ) + promptExtra,
                  maskSelection: selection,
                }));
                setSelectSourceBanner(
                  selection.toolId === "inpaint"
                    ? "已完成圈选：请在工作台填写要将该区域改成什么，然后提交。"
                    : "已完成圈选：区域 mask 已加入工作台，可补充说明后提交。",
                );
                hapticLight();
              }}
              batchTools={{
                tools,
                pendingToolId,
                onRunTool: (tool, item) =>
                  void handleRunSelectionTool(tool, item),
                onMentionItem: (item) => {
                  setMentionItemRequest((prev) => ({
                    key: (prev?.key ?? 0) + 1,
                    item,
                  }));
                  hapticLight();
                },
              }}
              onShareItem={async (item) => {
                try {
                  await copyTextToClipboard(assetUrl(item.url));
                  setSelectSourceBanner("图片链接已复制，可粘贴分享");
                } catch {
                  setSelectSourceBanner("复制失败，请重试");
                }
              }}
              onPublishItem={async (item) => {
                if (!item.outputId) {
                  setSelectSourceBanner("仅支持发布已生成的图片");
                  return;
                }
                try {
                  await publishCanvasToInspiration({
                    outputId: item.outputId,
                  });
                  setSelectSourceBanner(
                    "已发布到灵感发现 · 他人可制作同款并注入提示词",
                  );
                  hapticLight();
                } catch (err) {
                  setSelectSourceBanner(
                    err instanceof Error ? err.message : "发布失败，请重试",
                  );
                }
              }}
              selectionToolbar={
                <CanvasSelectionToolbar
                  tools={tools}
                  selectedItem={selectedCanvasItem}
                  readOnly={readOnly}
                  pendingToolId={pendingToolId}
                  layout={mobile ? "horizontal" : "vertical"}
                  onRunTool={(tool, item) =>
                    void handleRunSelectionTool(tool, item)
                  }
                  onMentionItem={(item) => {
                    setMentionItemRequest((prev) => ({
                      key: (prev?.key ?? 0) + 1,
                      item,
                    }));
                    hapticLight();
                  }}
                />
              }
              statusChip={<ProviderStatusChip />}
            />

            <StudioDock mode={dockMode} onModeChange={setDockMode}>
              <StudioCreationDock
                user={user}
                ready={ready}
                readOnly={readOnly}
                mode={mode}
                sessionId={sessionId}
                initialPrompt={initialPrompt}
                prompt={studioPrompt}
                onPromptChange={setStudioPrompt}
                restoredAssets={restoredAssets}
                inspirationApply={inspirationApply}
                onLogin={() => setLoginOpen(true)}
                onJobStarted={handleJobStarted}
                jobStreamStatus={jobStreamStatus}
                pollingJobId={pollingJobId}
                onCancelJob={handleCancelJob}
                jobElapsedMs={jobElapsedMs}
                queueAhead={queueAhead}
                canvasItems={canvasItems}
                selectedCanvasItem={selectedCanvasItem}
                onClearCanvasSelection={() => setSelectedCanvasId(null)}
                mentionItemRequest={mentionItemRequest}
                onUploadToCanvas={handleUploadToCanvas}
                onDockModeChange={setDockMode}
                focusEdit={
                  focusEditSession
                    ? {
                        points: focusEditSession.points,
                        intent: focusEditSession.intent,
                        cropSize: focusEditSession.cropSize,
                        recognizing: focusRecognizing,
                        onIntentChange: (intent) =>
                          setFocusEditSession((prev) =>
                            prev ? { ...prev, intent } : prev,
                          ),
                        onRemovePoint: (pointId) =>
                          setFocusEditSession((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  points: prev.points.filter(
                                    (p) => p.pointId !== pointId,
                                  ),
                                }
                              : prev,
                          ),
                        onEditPoint: (pointId, newName) =>
                          setFocusEditSession((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  points: prev.points.map((p) =>
                                    p.pointId === pointId
                                      ? { ...p, objectName: newName }
                                      : p,
                                  ),
                                }
                              : prev,
                          ),
                        onChipPromptChange: (pointId, chipPrompt) =>
                          setFocusEditSession((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  points: prev.points.map((p) =>
                                    p.pointId === pointId
                                      ? { ...p, chipPrompt }
                                      : p,
                                  ),
                                }
                              : prev,
                          ),
                        onReplaceImage: (pointId, assetId, url) =>
                          setFocusEditSession((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  points: prev.points.map((p) =>
                                    p.pointId === pointId
                                      ? {
                                          ...p,
                                          replaceAssetId: assetId,
                                          replaceAssetUrl: url,
                                        }
                                      : p,
                                  ),
                                }
                              : prev,
                          ),
                        onClearAll: () =>
                          setFocusEditSession((prev) =>
                            prev ? { ...prev, points: [] } : prev,
                          ),
                        onCropSizeChange: (size) =>
                          setFocusEditSession((prev) =>
                            prev ? { ...prev, cropSize: size } : prev,
                          ),
                        onCancel: exitFocusEditMode,
                      }
                    : null
                }
                onFocusEditSubmit={async ({ prompt, intent, points, item }) => {
                  const referenceOutputIds = item.outputId
                    ? [item.outputId]
                    : undefined;
                  const replaceAssets = points
                    .map((p) => p.replaceAssetId)
                    .filter((id): id is string => Boolean(id));
                  const assetIds = [
                    ...(!referenceOutputIds && item.assetId
                      ? [item.assetId]
                      : []),
                    ...replaceAssets,
                  ];
                  const chipLines = points
                    .map((p, i) => {
                      const chip = p.chipPrompt?.trim();
                      if (!chip) return null;
                      return `${focusIndexLabel(i)}${p.objectName}：${chip}`;
                    })
                    .filter((line): line is string => Boolean(line));
                  const mergedPrompt = [chipLines.join("；"), prompt.trim()]
                    .filter(Boolean)
                    .join("\n");
                  const { jobId } = await runTool("focus-edit", {
                    sessionId,
                    prompt: mergedPrompt || "按焦点区域进行局部编辑",
                    referenceOutputIds,
                    assetIds: assetIds.length ? assetIds : undefined,
                    resolution: resolveToolResolution("focus-edit"),
                    intent,
                    focusPoints: points.map((p) => ({
                      pointId: p.pointId,
                      objectName: p.objectName,
                      x: p.x,
                      y: p.y,
                    })),
                  });
                  void trackEvent("tool_run", {
                    tool_id: "focus-edit",
                    job_id: jobId,
                    intent,
                    focus_count: points.length,
                  });
                  registerToolBatchLineage(jobId, item, "焦点编辑");
                  exitFocusEditMode();
                  if (canvasRef.current?.isInRefineMode()) {
                    canvasRef.current.beginRefineJob();
                  }
                  setPollingJobId(jobId);
                  return jobId;
                }}
              />
            </StudioDock>
          </div>
          </StudioOrchestrationProvider>
        </div>
      </div>

      {user ? (
        <ContentReportDialog
          sessionId={sessionId}
          jobId={pollingJobId}
          open={reportOpen}
          onClose={() => setReportOpen(false)}
        />
      ) : null}
      <ToolConfirmDialog
        key={
          toolConfirm
            ? `${toolConfirm.tool.id}-${toolConfirm.item.id}`
            : "closed"
        }
        request={toolConfirm}
        pending={toolConfirmPending}
        onClose={() => {
          if (!toolConfirmPending) setToolConfirm(null);
        }}
        onConfirm={(opts) => void handleToolConfirm(opts)}
      />
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </WorkspaceProvider>
  );
}
