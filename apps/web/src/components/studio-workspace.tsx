"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { DesignCanvasHandle } from "@/components/design-canvas";
import { StudioCreationDock } from "@/components/studio-creation-dock";
import { StudioInfiniteSubmitBridge } from "@/components/studio-infinite-submit-bridge";
import { useStudioCanvasToolBridge } from "@/hooks/use-studio-canvas-tool-bridge";
import { StudioToolHandlersProvider } from "@/components/studio-tool-handlers-provider";
import { StudioDock, studioDockOverlayInsetPx, studioDockScrollInset } from "@/components/studio-dock";
import { StudioCoach } from "@/components/studio-coach";
import { StudioHeader } from "@/components/studio-header";
import {
  APP_LEFT_RAIL_PAD_CLASS,
  AppLeftRail,
} from "@/components/app-left-rail";
import { ProviderStatusChip } from "@/components/provider-status-banner";
import {
  type ToolGridResultState,
} from "@/components/tool-grid-result-panel";
import { StudioWorkspaceSidebar } from "@/components/studio-workspace/StudioWorkspaceSidebar";
import { StudioWorkspaceOverlays } from "@/components/studio-workspace/StudioWorkspaceOverlays";
import { WorkspaceProvider } from "@/lib/workspace-context";
import {
  defaultStudioDockMode,
  persistStudioDockMode,
  readStudioDockMode,
  type StudioDockMode,
} from "@/lib/studio-dock-state";
import { getActiveWorkspaceId } from "@/lib/active-workspace";
import { MOBILE_BREAKPOINT } from "@/lib/breakpoints";
import { formatJobErrorMessage } from "@/lib/job-error-message";
import { hapticLight } from "@/lib/haptics";
import { type CreationMode } from "@aimarket/ui";
import type { ImageSession, StudioTool } from "@/lib/types";
import type { CanvasItem } from "@/lib/canvas-tools";
import { StudioOrchestrationProvider } from "@/components/studio-orchestration-provider";
import { StudioCanvasWithOrchestration } from "@/components/studio-canvas-with-orchestration";
import { useAuth } from "@/lib/auth-context";
import {
  listSessions,
  trackEvent,
} from "@/lib/api-client";
import {
  pickLatestBatchFocusTarget,
} from "@/lib/canvas-tools";
import {
  type StudioInspirationApply,
} from "@/lib/inspiration-studio";
import type { DramaTemplateMetadata } from "@/lib/types";
import {
  prefetchSessionCanvasBundle,
  useSessionCanvas,
} from "@/hooks/use-session-canvas";
import { type PendingAsset } from "@/lib/pending-assets";
import { buildStudioUrl, studioUrlForSession } from "@/lib/studio-navigation";
import { type SessionKind } from "@/lib/session-kind";
import { clientNavigate } from "@/lib/client-navigate";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useConversationPaneWidth } from "@/hooks/use-conversation-pane-width";
import { useStudioToolHandlers } from "@/hooks/use-studio-tool-handlers";
import { useStudioJobStream } from "@/hooks/use-studio-job-stream";
import { useStudioFocusEdit } from "@/hooks/use-studio-focus-edit";
import { useStudioCanvasActions } from "@/hooks/use-studio-canvas-actions";
import {
  STUDIO_SIDEBAR_SESSION_LIMIT,
  useStudioSessionBootstrap,
} from "@/hooks/use-studio-session-bootstrap";
import type { StudioMentionItemRequest } from "@/lib/canvas-node-handlers";

import type { StudioWorkspaceProps } from "@/components/studio-workspace-types";

export type { StudioWorkspaceProps } from "@/components/studio-workspace-types";

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
  const clearBrushRef = useRef<(() => void) | null>(null);
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

  useStudioSessionBootstrap({
    sessionId,
    mode,
    initialTitle,
    initialKind,
    user,
    authLoading,
    activeWorkspaceId,
    loadCanvas,
    setCanvasItems,
    setCanEdit,
    setSelectedCanvasId,
    setRestoredAssets,
    setInspirationApply,
    setDramaTemplateApply,
    setStudioPrompt,
    setSessions,
    setTools,
    setReady,
    setFetchedSessionTitle,
    setActiveWorkspaceId,
  });

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

  const selectedCanvasItem =
    selectedCanvasId ?
      (canvasItems.find((i) => i.id === selectedCanvasId) ?? null)
    : null;

  const {
    focusRecognizing,
    focusClickRequest,
    startFocusEditMode,
    handleFocusImageClick,
    focusEditDockProps,
    handleFocusEditSubmit,
  } = useStudioFocusEdit({
    sessionId,
    user,
    readOnly,
    canvasItems,
    selectedCanvasItem,
    setSelectSourceBanner,
    setMentionItemRequest,
    setSelectedCanvasId,
    setDockMode,
    clearBrushRequest: () => clearBrushRef.current?.(),
    canvasRef,
    registerToolBatchLineage,
    setPollingJobId,
  });

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

  clearBrushRef.current = () => setBrushRequest(null);

  const {
    videoActionBusy,
    handleCanvasDownload,
    handleCanvasUpload,
    onFileSelected,
    handleUploadToCanvas,
    handleDeleteCanvasItem,
    handleRerun,
    handleExtractVideoLastFrame,
    handleAddVideoBgm,
    onBgmFileSelected,
  } = useStudioCanvasActions({
    sessionId,
    mode,
    user,
    readOnly,
    canvasItems,
    canvasItemsRef,
    selectedCanvasId,
    uploadRef,
    bgmInputRef,
    setCanvasItems,
    setSelectedCanvasId,
    setLoginOpen,
    setSelectSourceBanner,
    setMentionItemRequest,
    setPollingJobId,
    registerToolBatchLineage,
  });

  const canvasToolBridge = useStudioCanvasToolBridge({
    readOnly,
    mobile,
    tools,
    canvasItems,
    selectedCanvasItem,
    pendingToolId,
    brushRequest,
    setBrushRequest,
    expandRequest,
    setExpandRequest,
    focusClickRequest,
    handleFocusImageClick,
    runSelectionTool,
    runQuickToolFromCanvas,
    runInfiniteNodeTool,
    executeDirectTool,
    handleRerun,
    handleExtractVideoLastFrame,
    handleAddVideoBgm,
    videoActionBusy,
    setMentionItemRequest,
    setSelectSourceBanner,
  });

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
        <StudioWorkspaceSidebar
          showTopBar={showTopBar}
          sidebarOpen={sidebarOpen}
          workspaceCollapsed={workspaceCollapsed}
          workspaceWidth={workspaceWidth}
          sessionId={sessionId}
          sessionTitle={sessionTitle}
          sessionKind={sessionKind}
          mode={mode}
          readOnly={readOnly}
          user={user}
          displaySessions={displaySessions}
          onCloseSidebar={() => setSidebarOpen(false)}
          onCollapseWorkspace={() => setWorkspaceCollapsed(true)}
          onOpenReport={() => setReportOpen(true)}
          onNewStudio={openNewStudio}
          onWorkspaceChange={handleWorkspaceChange}
          onTitleSaved={handleTitleSaved}
          onSessionDeleted={handleSessionDeleted}
          setSessions={setSessions}
        />

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
          <StudioToolHandlersProvider value={canvasToolBridge}>
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
                focusEdit={focusEditDockProps}
                onFocusEditSubmit={handleFocusEditSubmit}
                autoSubmitOnce={autoSubmitOnce}
              />
            </StudioDock>
            ) : null}
          </div>
          </StudioOrchestrationProvider>
          </StudioToolHandlersProvider>
        </div>
      </div>

      <StudioWorkspaceOverlays
        user={user}
        sessionId={sessionId}
        pollingJobId={pollingJobId}
        reportOpen={reportOpen}
        onReportClose={() => setReportOpen(false)}
        loginOpen={loginOpen}
        onLoginClose={() => setLoginOpen(false)}
        toolConfirm={toolConfirm}
        toolConfirmPending={toolConfirmPending}
        onToolConfirmClose={() => {
          if (!toolConfirmPending) setToolConfirm(null);
        }}
        onConfirmTool={(opts) => void confirmTool(opts)}
        toolGridResult={toolGridResult}
        onToolGridResultClose={() => setToolGridResult(null)}
      />

    </WorkspaceProvider>
  );
}
