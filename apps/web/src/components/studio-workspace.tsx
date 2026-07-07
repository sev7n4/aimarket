"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SessionTitleActions } from "@/components/session-title-actions";
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Plus,
  X,
} from "lucide-react";
import { LoginDialog } from "@/components/login-dialog";
import type { DesignCanvasHandle } from "@/components/design-canvas";
import { StudioCreationDock } from "@/components/studio-creation-dock";
import { StudioInfiniteSubmitBridge } from "@/components/studio-infinite-submit-bridge";
import { CanvasSelectionToolbar } from "@/components/canvas-selection-toolbar";
import { StudioDock, studioDockOverlayInsetPx, studioDockScrollInset } from "@/components/studio-dock";
import { StudioCoach } from "@/components/studio-coach";
import { StudioHeader } from "@/components/studio-header";
import {
  APP_LEFT_RAIL_PAD_CLASS,
  AppLeftRail,
} from "@/components/app-left-rail";
import { ProviderStatusChip } from "@/components/provider-status-banner";
import { ContentReportDialog } from "@/components/content-report-dialog";
import {
  ToolConfirmDialog,
  type ToolConfirmOptions,
} from "@/components/tool-confirm-dialog";
import { GridSplitPanel } from "@/components/grid-split-panel";
import {
  ToolGridResultPanel,
  type ToolGridResultState,
} from "@/components/tool-grid-result-panel";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
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
import type { CanvasItem } from "@/lib/canvas-tools";
import { StudioOrchestrationProvider } from "@/components/studio-orchestration-provider";
import { StudioCanvasWithOrchestration } from "@/components/studio-canvas-with-orchestration";
import { useAuth } from "@/lib/auth-context";
import {
  assetUrl,
  ensureSession,
  fetchSession,
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
  requestVideoBgmMux,
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
  consumePendingDramaTemplate,
  importInspirationReferencesToCanvas,
  type StudioInspirationApply,
} from "@/lib/inspiration-studio";
import type { DramaTemplateMetadata } from "@/lib/types";
import { persistCreationLane } from "@/lib/creation-dock-prefs";
import { extractVideoLastFrame } from "@/lib/video-frame-extract";
import {
  prefetchSessionCanvasBundle,
  useSessionCanvas,
} from "@/hooks/use-session-canvas";
import { consumePendingAssets, type PendingAsset } from "@/lib/pending-assets";
import { consumePendingInspiration, normalizePendingInspiration } from "@/lib/pending-inspiration";
import {
  paddingToExtend,
} from "@/lib/expand-frame";
import { focusIndexLabel } from "@/lib/focus-index-labels";
import { resolveToolResolution } from "@/lib/tool-resolution";
import { hapticLight } from "@/lib/haptics";
import { type SessionKind } from "@/lib/session-kind";
import { buildStudioUrl, studioUrlForSession } from "@/lib/studio-navigation";
import { clientNavigate } from "@/lib/client-navigate";
import { writeDraftSessionId } from "@/lib/studio-draft-session";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useConversationPaneWidth } from "@/hooks/use-conversation-pane-width";
import { useStudioToolHandlers } from "@/hooks/use-studio-tool-handlers";
import { useStudioJobStream } from "@/hooks/use-studio-job-stream";
import { buildToolPromptSuffix } from "@/lib/studio-tool-interaction";
import type { StudioMentionItemRequest } from "@/lib/canvas-node-handlers";

const FOCUS_CLICK_DEBOUNCE_MS = 1500;

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
  autoSubmitOnce?: boolean;
}

export function StudioWorkspace({
  sessionId,
  initialMode,
  initialPrompt,
  initialTitle,
  initialKind,
  initialJobId,
  initialToolId,
  autoSubmitOnce = false,
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
  const { user, loading: authLoading, refreshUser } = useAuth();
  const uploadRef = useRef<HTMLInputElement>(null);
  const bgmInputRef = useRef<HTMLInputElement>(null);
  const pendingBgmVideoRef = useRef<CanvasItem | null>(null);
  const [videoActionBusy, setVideoActionBusy] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(false);
  const [dockMode, setDockMode] = useState<StudioDockMode>("expanded");
  const [infiniteCanvasActive, setInfiniteCanvasActive] = useState(false);
  const [infiniteSubmitApi, setInfiniteSubmitApi] = useState<{
    submit: () => Promise<void>;
    submitting: boolean;
  } | null>(null);
  const [conversationPaneActive, setConversationPaneActive] = useState(false);
  const {
    width: conversationPaneWidth,
    isDragging: conversationPaneResizing,
    handleDragStart: handleConversationPaneResizeStart,
  } = useConversationPaneWidth();
  const [workspaceWidth, setWorkspaceWidth] = useState(264);
  const [isDraggingWorkspace, setIsDraggingWorkspace] = useState(false);
  const [restoredAssets, setRestoredAssets] = useState<PendingAsset[]>([]);
  const [inspirationApply, setInspirationApply] =
    useState<StudioInspirationApply | null>(null);
  const [dramaTemplateApply, setDramaTemplateApply] =
    useState<DramaTemplateMetadata | null>(null);
  const [selectSourceBanner, setSelectSourceBanner] = useState<string | null>(
    null,
  );

  const [mode, setMode] = useState<CreationMode>(initialMode);
  const [selectedCanvasId, setSelectedCanvasId] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    setFetchedSessionTitle(null);
    setStudioPrompt("");
  }, [sessionId]);


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
    infiniteConnections,
    setInfiniteConnections,
    dramaNodePositions,
    setDramaNodePositions,
    load: loadCanvas,
    registerBatchLineage,
    canEdit: canvasCanEdit,
    setCanEdit,
  } = useSessionCanvas(sessionId, Boolean(user), { autoLoad: false });
  loadCanvasRef.current = loadCanvas;
  canvasItemsRef.current = canvasItems;
  const [sessions, setSessions] = useState<ImageSession[]>([]);
  /** fetchSession 已返回、侧栏 list 尚未就绪时的标题回退 */
  const [fetchedSessionTitle, setFetchedSessionTitle] = useState<string | null>(
    null,
  );
  const [tools, setTools] = useState<StudioTool[]>([]);
  const [ready, setReady] = useState(false);
  const [toolGridResult, setToolGridResult] =
    useState<ToolGridResultState | null>(null);
  const [studioPrompt, setStudioPrompt] = useState(initialPrompt);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    null,
  );
  const [mentionItemRequest, setMentionItemRequest] =
    useState<StudioMentionItemRequest | null>(null);
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

  const handleWorkspaceChange = useCallback(
    (id: string) => {
      setActiveWorkspaceId(id);
      void listSessions(STUDIO_SIDEBAR_SESSION_LIMIT, undefined, id).then(
        (list) => {
          setSessions(list);
          if (list.length > 0 && !list.some((s) => s.id === sessionId)) {
            router.push(
              studioUrlForSession({
                id: list[0]!.id,
                mode: list[0]!.mode,
                kind: list[0]!.kind,
              }),
            );
          }
        },
      );
    },
    [sessionId, router],
  );

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
      : fetchedSessionTitle && fetchedSessionTitle !== "未命名"
        ? fetchedSessionTitle
        : initialTitle ?? (mode === "production" ? "未命名制片" : mode === "ecommerce" ? "电商套图" : "未命名");

  /** 当前草稿尚未入库时，乐观插入侧栏列表顶部 */
  const displaySessions = useMemo(() => {
    if (!sessionId || sessions.some((s) => s.id === sessionId)) {
      return sessions;
    }
    const draftSession: ImageSession = {
      id: sessionId,
      title: sessionTitle,
      mode,
      kind: sessionKind,
      status: "draft",
      updated_at: new Date().toISOString(),
      can_edit: true,
    };
    return [draftSession, ...sessions];
  }, [sessions, sessionId, sessionTitle, mode, sessionKind]);

  const infiniteOverlayBottomInsetPx =
    infiniteCanvasActive ? 0 : studioDockOverlayInsetPx(dockMode);

  const handleInfiniteSubmitReady = useCallback(
    (api: { submit: () => Promise<void>; submitting: boolean }) => {
      setInfiniteSubmitApi((prev) =>
        prev?.submit === api.submit && prev.submitting === api.submitting
          ? prev
          : api,
      );
    },
    [],
  );

  const openNewStudio = useCallback(() => {
    const wsId = activeWorkspaceId ?? getActiveWorkspaceId();
    clientNavigate(
      router,
      buildStudioUrl(sessionKind === "project" ? "project" : "canvas", {
        mode,
        workspaceId: wsId,
        newDraft: true,
        title:
          mode === "production"
            ? "未命名制片"
            : mode === "ecommerce"
              ? "电商套图"
              : "未命名",
      }),
    );
  }, [router, mode, sessionKind, activeWorkspaceId]);

  const applySourceInspiration = useCallback(
    (src: NonNullable<Awaited<ReturnType<typeof ensureSession>>["sourceInspiration"]>) => {
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
    },
    [],
  );

  const initSession = useCallback(async () => {
    if (!user) return;
    const pending = consumePendingAssets(sessionId);
    if (pending.length) setRestoredAssets(pending);

    const pendingRaw = consumePendingInspiration(sessionId);
    const pendingInspiration = pendingRaw
      ? normalizePendingInspiration(pendingRaw)
      : null;
    const pendingDramaTemplate = consumePendingDramaTemplate(sessionId);
    if (pendingDramaTemplate) {
      const { inspirationId: _inspId, title: _title, ...tpl } = pendingDramaTemplate;
      setDramaTemplateApply(tpl);
      if (tpl.userIdea) {
        setStudioPrompt(tpl.userIdea);
      }
    }
    if (pendingInspiration) {
      persistCreationLane("studio", pendingInspiration.creationLane);
      setInspirationApply({
        ...pendingInspiration,
        aspectRatio: coerceInspirationAspect(pendingInspiration.aspectRatio),
        applyKey: 1,
      });
    }

    const wsId = activeWorkspaceId ?? getActiveWorkspaceId() ?? undefined;
    writeDraftSessionId(sessionId, wsId);

    const mustPersist = pending.length > 0 || pendingInspiration != null;
    let existing: Awaited<ReturnType<typeof fetchSession>> | null = null;
    if (!mustPersist) {
      try {
        existing = await fetchSession(sessionId);
      } catch {
        existing = null;
      }
    }

    if (mustPersist) {
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
      if (!pendingInspiration && ensured.sourceInspiration) {
        applySourceInspiration(ensured.sourceInspiration);
        if (
          mode === "production" &&
          ensured.sourceInspiration.dramaTemplate
        ) {
          setDramaTemplateApply(ensured.sourceInspiration.dramaTemplate);
          setStudioPrompt(ensured.sourceInspiration.dramaTemplate.userIdea);
        }
      }
      await loadCanvas();
      if (pendingInspiration?.referenceUrls.length) {
        const refItems = await importInspirationReferencesToCanvas(
          sessionId,
          pendingInspiration.referenceUrls,
        );
        setCanvasItems((prev) => [...prev, ...refItems]);
        if (refItems[0]) setSelectedCanvasId(refItems[0].id);
      }
    } else if (existing) {
      setCanEdit(existing.can_edit ?? true);
      if (existing.title) setFetchedSessionTitle(existing.title);
      if (!pendingInspiration && existing.sourceInspiration) {
        applySourceInspiration(existing.sourceInspiration);
        if (
          mode === "production" &&
          existing.sourceInspiration.dramaTemplate &&
          !pendingDramaTemplate
        ) {
          setDramaTemplateApply(existing.sourceInspiration.dramaTemplate);
          setStudioPrompt(existing.sourceInspiration.dramaTemplate.userIdea);
        }
      }
      await loadCanvas();
    } else {
      /** 本地草稿：尚未入库，避免打开空白 Studio 即创建「新建画布」 */
      setCanEdit(true);
    }

    const listPromise = listSessions(
      STUDIO_SIDEBAR_SESSION_LIMIT,
      undefined,
      wsId,
    );
    const toolsPromise = fetchTools().catch(() => []);
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
    applySourceInspiration,
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
    setReady(false);
    initSession().catch(() => setReady(true));
  }, [authLoading, user, sessionId, initSession]);

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

  const {
    pollingJobId,
    setPollingJobId,
    jobStreamStatus,
    jobProgressCompleted,
    jobProgressTotal,
    queueAhead,
    jobFailed,
    jobError,
    jobFailedToolType,
    jobElapsedMs,
    infiniteEmptySubmitting,
    activeJobPrompt,
    jobStartedAt,
    dismissJobFailure,
    handleJobStarted,
    handleCancelJob,
  } = useStudioJobStream({
    user,
    sessionId,
    mode,
    router,
    studioPrompt,
    activeWorkspaceId,
    initialJobId,
    canvasRef,
    canvasItemsRef,
    loadCanvas,
    loadCanvasRef,
    refreshUser,
    registerBatchLineage,
    setSessions,
    setSelectedCanvasId,
    setSelectSourceBanner,
    setToolGridResult,
    scrollToLatestCanvasBatch,
  });

  useEffect(() => {
    const count = canvasItems.length;
    if (count > prevItemCountRef.current && pollingJobId) {
      scrollToLatestCanvasBatch();
    }
    prevItemCountRef.current = count;
  }, [canvasItems.length, pollingJobId, scrollToLatestCanvasBatch]);

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

  const {
    pendingToolId,
    toolConfirm,
    toolConfirmPending,
    setToolConfirm,
    brushRequest,
    setBrushRequest,
    expandRequest,
    setExpandRequest,
    runSelectionTool,
    runQuickToolFromCanvas,
    runInfiniteNodeTool,
    executeDirectTool,
    confirmTool,
  } = useStudioToolHandlers({
    sessionId,
    readOnly,
    user,
    tools,
    canvasItems,
    canvasRef,
    registerBatchLineage,
    onJobStarted: (jobId) => handleJobStarted(jobId),
    setPollingJobId,
    setSelectedCanvasId,
    onRequireLogin: () => setLoginOpen(true),
    setSelectSourceBanner,
    setMentionItemRequest,
    startFocusEditMode,
  });

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

  async function handleExtractVideoLastFrame(item: CanvasItem) {
    if (!user) {
      setLoginOpen(true);
      return;
    }
    if (readOnly || !item.isVideo) return;
    setVideoActionBusy(true);
    setSelectSourceBanner("正在提取视频尾帧...");
    try {
      const blob = await extractVideoLastFrame(item.url);
      const file = new File([blob], `last-frame-${item.id.slice(0, 8)}.jpg`, {
        type: "image/jpeg",
      });
      await ensureSession(sessionId, mode);
      const { id, url, thumbUrl } = await uploadAsset(file, sessionId);
      const newItem = createUploadCanvasItem(url, canvasItemsRef.current, {
        assetId: id,
        role: "reference",
        label: "视频尾帧",
        thumbUrl,
      });
      setCanvasItems((prev) => [...prev, newItem]);
      setMentionItemRequest((prev) => ({
        key: (prev?.key ?? 0) + 1,
        item: newItem,
      }));
      setSelectSourceBanner("尾帧已提取并加入画布，已引用到工作台");
      hapticLight();
    } catch (err) {
      setSelectSourceBanner(
        err instanceof Error ? err.message : "尾帧提取失败",
      );
    } finally {
      setVideoActionBusy(false);
    }
  }

  function handleAddVideoBgm(item: CanvasItem) {
    if (!user) {
      setLoginOpen(true);
      return;
    }
    if (readOnly || !item.isVideo) return;
    pendingBgmVideoRef.current = item;
    bgmInputRef.current?.click();
  }

  async function onBgmFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const item = pendingBgmVideoRef.current;
    pendingBgmVideoRef.current = null;
    if (!file || !item || !user) return;
    setVideoActionBusy(true);
    setSelectSourceBanner("正在上传音频...");
    try {
      await ensureSession(sessionId, mode);
      const { id } = await uploadAsset(file, sessionId);
      const { outputUrl, assetId } = await requestVideoBgmMux({
        sessionId,
        videoUrl: assetUrl(item.url),
        audioAssetId: id,
      });
      const muxedItem = {
        ...createUploadCanvasItem(outputUrl, canvasItemsRef.current, {
          assetId,
          role: "output" as const,
          label: "配乐视频",
        }),
        isVideo: true,
      };
      setCanvasItems((prev) => [...prev, muxedItem]);
      setSelectedCanvasId(muxedItem.id);
      setSelectSourceBanner("配乐视频已合成并加入画布");
      hapticLight();
    } catch (err) {
      setSelectSourceBanner(err instanceof Error ? err.message : "配乐失败");
    } finally {
      setVideoActionBusy(false);
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
        clientNavigate(
          router,
          buildStudioUrl(sessionKind === "project" ? "project" : "canvas", {
            mode,
            workspaceId: activeWorkspaceId ?? getActiveWorkspaceId(),
            newDraft: true,
          }),
        );
      }
    },
    [sessionId, mode, sessionKind, router, activeWorkspaceId],
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

  /** 移动端与收起工作区时展示顶栏汉堡，打开工作区抽屉 */
  const showTopBar = mobile || workspaceCollapsed;

  return (
    <WorkspaceProvider onWorkspaceChange={handleWorkspaceChange}>
      <AppLeftRail
        variant="studio"
        onOpenWorkspace={() => setSidebarOpen(true)}
        onLogin={() => setLoginOpen(true)}
      />

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
      <input
        ref={bgmInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => void onBgmFileSelected(e)}
        aria-label="选择背景音乐"
      />

      <StudioCoach />

      <div className={`relative flex min-h-0 flex-1 ${APP_LEFT_RAIL_PAD_CLASS}`}>
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
          className={`fixed bottom-0 left-0 z-50 flex min-h-0 w-[min(85vw,280px)] flex-col border-r border-white/5 bg-[#080808] p-3 transition-all lg:left-14 ${
            showTopBar ? "top-12" : "top-0"
          } ${
            sidebarOpen
              ? "translate-x-0"
              : "-translate-x-full pointer-events-none"
          } ${
            workspaceCollapsed
              ? "lg:hidden"
              : "lg:pointer-events-auto lg:static lg:top-auto lg:z-0 lg:m-2 lg:mr-0 lg:w-auto lg:translate-x-0 lg:rounded-2xl lg:border lg:bg-[#090909]/95"
          }`}
        >
          <div className="mb-2 flex items-center justify-between lg:hidden">
            <span className="text-xs font-medium text-zinc-500">工作区</span>
            <div className="flex items-center gap-1">
              {user && sessionId ? (
                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  className="rounded-lg p-1.5 text-zinc-500 hover:text-amber-300"
                  aria-label="举报违规内容"
                  title="举报违规内容"
                >
                  <Flag className="size-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg p-1 text-zinc-500 hover:text-white"
                title="关闭侧栏"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

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
                openNewStudio();
              }}
              data-testid="studio-workspace-new"
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
            {displaySessions.map((s) => (
              <li key={s.id} className="group">
                <Link
                  href={studioUrlForSession({
                    id: s.id,
                    mode: s.mode,
                    kind: s.kind,
                  })}
                  data-testid={`studio-session-row-${s.id}`}
                  onMouseEnter={() => prefetchSessionCanvasBundle(s.id)}
                  onFocus={() => prefetchSessionCanvasBundle(s.id)}
                  onClick={(e) => {
                    if (s.id === sessionId) {
                      e.preventDefault();
                      return;
                    }
                    e.preventDefault();
                    setSidebarOpen(false);
                    clientNavigate(
                      router,
                      studioUrlForSession({
                        id: s.id,
                        mode: s.mode,
                        kind: s.kind,
                      }),
                    );
                  }}
                  className={`block w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition ${
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
                    {s.status === "draft" ? "草稿 · " : "画布 · "}
                    {s.mode}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
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
          <StudioOrchestrationProvider
            sessionId={sessionId}
            mode={mode}
            readOnly={readOnly}
            initialDramaTemplate={dramaTemplateApply}
            onApplyDramaTemplate={(tpl) => setStudioPrompt(tpl.userIdea)}
            onJobStarted={handleJobStarted}
            onClearPrompt={() => setStudioPrompt("")}
            onRunSettled={() => {
              void loadCanvas({ force: true });
              void refreshUser();
            }}
          >
            {infiniteCanvasActive ? (
              <StudioInfiniteSubmitBridge
                sessionId={sessionId}
                mode={mode}
                prompt={studioPrompt}
                readOnly={readOnly}
                user={user}
                canvasItems={canvasItems}
                onJobStarted={handleJobStarted}
                onAuthRequired={() => setLoginOpen(true)}
                onPromptClear={() => setStudioPrompt("")}
                onInteractionHint={(message) => setSelectSourceBanner(message)}
                onReady={handleInfiniteSubmitReady}
              />
            ) : null}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            {readOnly ? (
              <p className="shrink-0 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200/90">
                只读：他人会话，仅创建者或管理员可编辑与生成
              </p>
            ) : null}
            <StudioCanvasWithOrchestration
              key={sessionId}
              ref={canvasRef}
              onInfiniteCanvasActiveChange={setInfiniteCanvasActive}
              onConversationPaneActiveChange={setConversationPaneActive}
              conversationPaneWidth={conversationPaneWidth}
              onConversationPaneResizeStart={handleConversationPaneResizeStart}
              conversationPaneResizing={conversationPaneResizing}
              overlayBottomInsetPx={infiniteOverlayBottomInsetPx}
              infiniteEmptyCreation={
                infiniteCanvasActive
                  ? {
                      prompt: studioPrompt,
                      onPromptChange: setStudioPrompt,
                      onSubmit: () => void infiniteSubmitApi?.submit(),
                      submitting:
                        (infiniteSubmitApi?.submitting ?? false) ||
                        infiniteEmptySubmitting,
                    }
                  : undefined
              }
              items={canvasItems}
              infiniteConnections={infiniteConnections}
              onInfiniteConnectionsChange={setInfiniteConnections}
              dramaNodePositions={dramaNodePositions}
              onDramaNodePositionsChange={setDramaNodePositions}
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
              emptyHint=""
              scrollBottomInset={
                infiniteCanvasActive ? "" : studioDockScrollInset(dockMode)
              }
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
              pendingJobPrompt={activeJobPrompt}
              jobStartedAt={jobStartedAt}
              selectSourceBanner={selectSourceBanner}
              showFailureBannerDismiss={jobFailed}
              nodeActions={{
                onCutoutItem: (item) => runQuickToolFromCanvas(item, "cutout"),
                onExpandItem: (item) => runQuickToolFromCanvas(item, "expand"),
                onRerun: (item) => void handleRerun(item),
                onRunInfiniteNodeTool: (req) => void runInfiniteNodeTool(req),
                batchTools: {
                  tools,
                  pendingToolId,
                  onRunTool: (tool, item) => void runSelectionTool(tool, item),
                  onMentionItem: (item) => {
                    setMentionItemRequest((prev) => ({
                      key: (prev?.key ?? 0) + 1,
                      item,
                    }));
                    hapticLight();
                  },
                  onExtractVideoLastFrame: (item) =>
                    void handleExtractVideoLastFrame(item),
                  onAddVideoBgm: handleAddVideoBgm,
                  videoActionBusy,
                },
                onShareItem: async (item) => {
                  try {
                    await copyTextToClipboard(assetUrl(item.url));
                    setSelectSourceBanner("图片链接已复制，可粘贴分享");
                  } catch {
                    setSelectSourceBanner("复制失败，请重试");
                  }
                },
                onPublishItem: async (item) => {
                  if (!item.outputId) {
                    setSelectSourceBanner("仅支持发布已生成的图片或视频");
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
                },
              }}
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
              selectionToolbar={
                <CanvasSelectionToolbar
                  tools={tools}
                  selectedItem={selectedCanvasItem}
                  readOnly={readOnly}
                  pendingToolId={pendingToolId}
                  layout={mobile ? "horizontal" : "vertical"}
                  onRunTool={(tool, item) =>
                    void runSelectionTool(tool, item)
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

            {!infiniteCanvasActive ? (
            <StudioDock
              mode={dockMode}
              onModeChange={setDockMode}
              alignLeft={conversationPaneActive}
              alignLeftWidth={conversationPaneWidth}
            >
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
                dockExpanded={dockMode === "expanded" && mode === "production"}
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
                autoSubmitOnce={autoSubmitOnce}
              />
            </StudioDock>
            ) : null}
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
        request={toolConfirm?.tool.id === "grid-split" ? null : toolConfirm}
        pending={toolConfirmPending}
        onClose={() => {
          if (!toolConfirmPending) setToolConfirm(null);
        }}
        onConfirm={(opts) => void confirmTool(opts)}
      />
      {toolConfirm?.tool.id === "grid-split" ? (
        <GridSplitPanel
          key={`${toolConfirm.tool.id}-${toolConfirm.item.id}`}
          tool={toolConfirm.tool}
          item={toolConfirm.item}
          pending={toolConfirmPending}
          onClose={() => {
            if (!toolConfirmPending) setToolConfirm(null);
          }}
          onConfirm={(opts) => {
            // 将行列数编码到 prompt 中传递给后端
            void confirmTool({
              count: 1,
              prompt: `宫格切分 ${opts.rows}×${opts.cols}`,
            });
          }}
        />
      ) : null}
      {toolGridResult ? (
        <ToolGridResultPanel
          result={toolGridResult}
          onClose={() => setToolGridResult(null)}
        />
      ) : null}
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </WorkspaceProvider>
  );
}
