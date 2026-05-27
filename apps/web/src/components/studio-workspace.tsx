"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SessionTitleActions } from "@/components/session-title-actions";
import { CanvasRoleActions } from "@/components/canvas-role-actions";
import { InspirationSetGenerateBar } from "@/components/inspiration-set-generate-bar";
import { X } from "lucide-react";
import { LoginDialog } from "@/components/login-dialog";
import { AppLeftRail } from "@/components/app-left-rail";
import {
  DesignCanvas,
  type DesignCanvasHandle,
} from "@/components/design-canvas";
import { WorkbenchPanel } from "@/components/workbench-panel";
import { StudioHeader } from "@/components/studio-header";
import { ProviderStatusBanner } from "@/components/provider-status-banner";
import { ContentReportDialog } from "@/components/content-report-dialog";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { StudioMobileCoach } from "@/components/studio-mobile-coach";
import { getActiveWorkspaceId } from "@/lib/active-workspace";
import { MOBILE_BREAKPOINT } from "@/lib/breakpoints";
import { resolveApiBase } from "@/lib/api-base";
import { trackEvent } from "@/lib/api-client";
import { type CreationMode } from "@aimarket/ui";
import type { ImageSession, StudioTool } from "@/lib/types";
import type { CanvasItem, CanvasItemRole } from "@/lib/canvas-tools";
import { assignCanvasItemRole } from "@/lib/canvas-roles";
import { useAuth } from "@/lib/auth-context";
import {
  assetUrl,
  ensureSession,
  exportSession,
  fetchTools,
  listSessions,
  runTool,
  uploadAsset,
} from "@/lib/api-client";
import { createUploadCanvasItem } from "@/lib/canvas-tools";
import {
  coerceInspirationAspect,
  importInspirationReferencesToCanvas,
  type StudioInspirationApply,
} from "@/lib/inspiration-studio";
import { useSessionCanvas } from "@/hooks/use-session-canvas";
import { watchJob } from "@/lib/job-stream";
import { consumePendingAssets, type PendingAsset } from "@/lib/pending-assets";
import { consumePendingInspiration } from "@/lib/pending-inspiration";
import { resolveToolResolution } from "@/lib/tool-resolution";
import { hapticLight } from "@/lib/haptics";
import { canvasEmptyHintMobile } from "@/lib/mobile-labels";
import { SESSION_KIND_LABEL, type SessionKind } from "@/lib/session-kind";
import { buildStudioUrl, studioUrlForSession } from "@/lib/studio-navigation";
import { useIsMobile } from "@/hooks/use-is-mobile";

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
  const canvasRef = useRef<DesignCanvasHandle>(null);
  const prevItemCountRef = useRef(0);
  const { user, loading: authLoading, refreshUser } = useAuth();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [workbenchOpen, setWorkbenchOpen] = useState(true);
  const [restoredAssets, setRestoredAssets] = useState<PendingAsset[]>([]);
  const [inspirationApply, setInspirationApply] =
    useState<StudioInspirationApply | null>(null);
  const [selectSourceBanner, setSelectSourceBanner] = useState<string | null>(
    null,
  );
  const [jobFailed, setJobFailed] = useState(false);
  const [pendingToolAfterSelect, setPendingToolAfterSelect] =
    useState<StudioTool | null>(null);

  useEffect(() => {
    if (mobile) setWorkbenchOpen(false);
  }, [mobile]);

  const [mode, setMode] = useState<CreationMode>(initialMode);
  const [selectedCanvasId, setSelectedCanvasId] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!user) return;
    void trackEvent("studio_open", { sessionId, mode });
  }, [user, sessionId, mode]);

  const {
    items: canvasItems,
    setItems: setCanvasItems,
    messages,
    load: loadCanvas,
    canEdit: canvasCanEdit,
    setCanEdit,
  } = useSessionCanvas(sessionId, Boolean(user));
  const [sessions, setSessions] = useState<ImageSession[]>([]);
  const [tools, setTools] = useState<StudioTool[]>([]);
  const [activeTool, setActiveTool] = useState<StudioTool | null>(null);
  const [toolPrompt, setToolPrompt] = useState("");
  const [ready, setReady] = useState(false);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [jobStreamStatus, setJobStreamStatus] = useState<string | null>(null);
  const [jobProgressCompleted, setJobProgressCompleted] = useState(0);
  const [jobProgressTotal, setJobProgressTotal] = useState(0);
  const lastOutputCountRef = useRef(0);
  const [toolPending, setToolPending] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    null,
  );

  const handleWorkspaceChange = useCallback((id: string) => {
    setActiveWorkspaceId(id);
    void listSessions(20, undefined, id).then(setSessions);
  }, []);

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

    const pendingInspiration = consumePendingInspiration(sessionId);
    if (pendingInspiration) {
      setInspirationApply({
        ...pendingInspiration,
        aspectRatio: coerceInspirationAspect(pendingInspiration.aspectRatio),
        applyKey: 1,
      });
    }

    const wsId = activeWorkspaceId ?? getActiveWorkspaceId() ?? undefined;
    const ensured = await ensureSession(sessionId, mode, {
      title: initialTitle ?? pendingInspiration?.title,
      kind: pendingInspiration ? "project" : (initialKind ?? "canvas"),
      workspaceId: wsId,
      sourceInspirationId: pendingInspiration?.id,
    });
    setCanEdit(ensured.can_edit ?? true);
    await loadCanvas();
    if (pendingInspiration?.referenceUrls.length) {
      const refItems = await importInspirationReferencesToCanvas(
        sessionId,
        pendingInspiration.referenceUrls,
      );
      setCanvasItems((prev) => (prev.length > 0 ? prev : refItems));
      if (refItems[0]) setSelectedCanvasId(refItems[0].id);
    }
    const [list, toolList] = await Promise.all([
      listSessions(20, undefined, wsId),
      fetchTools().catch(() => []),
    ]);
    setSessions(list);
    setTools(toolList);
    setReady(true);
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
    if (!inspirationApply) return;
    setWorkbenchOpen(true);
  }, [inspirationApply?.applyKey]);

  useEffect(() => {
    if (!initialJobId || !user) return;
    setPollingJobId(initialJobId);
    if (mobile) {
      const t = window.setTimeout(() => setWorkbenchOpen(true), 2500);
      return () => clearTimeout(t);
    }
  }, [initialJobId, user, mobile]);

  useEffect(() => {
    if (!initialToolId || !tools.length) return;
    const tool = tools.find((t) => t.id === initialToolId);
    if (!tool) return;
    setActiveTool(tool);
    setToolPrompt(tool.defaultPrompt);
    if (mobile) setWorkbenchOpen(true);
    if (tool.requiresSource) {
      setSelectSourceBanner("请先在画布点选一张图片，再运行此工具");
    }
  }, [initialToolId, tools, mobile]);

  const focusLatestCanvasItem = useCallback(() => {
    if (!canvasItems.length) return;
    const latest = canvasItems[canvasItems.length - 1];
    setSelectedCanvasId(latest.id);
    canvasRef.current?.fitToItem(latest.id);
    canvasRef.current?.pulseItem(latest.id);
  }, [canvasItems]);

  const handleJobComplete = useCallback(async () => {
    setJobFailed(false);
    setPollingJobId(null);
    setJobStreamStatus(null);
    setJobProgressCompleted(0);
    setJobProgressTotal(0);
    lastOutputCountRef.current = 0;
    await loadCanvas();
    await refreshUser();
    setSessions(
      await listSessions(20, undefined, activeWorkspaceId ?? undefined),
    );
    window.requestAnimationFrame(() => focusLatestCanvasItem());
  }, [loadCanvas, refreshUser, activeWorkspaceId, focusLatestCanvasItem]);

  useEffect(() => {
    if (!pollingJobId || !user) return;
    const t0 = performance.now();
    const jobId = pollingJobId;
    setJobFailed(false);
    setJobStreamStatus("queued");
    setJobProgressCompleted(0);
    setJobProgressTotal(0);
    lastOutputCountRef.current = 0;
    const stop = watchJob(
      jobId,
      (ev) => {
        setJobStreamStatus(ev.status);
        if (ev.count) setJobProgressTotal(ev.count);
        if (typeof ev.completed === "number") {
          setJobProgressCompleted(ev.completed);
          if (
            ev.status === "running" &&
            ev.completed > lastOutputCountRef.current
          ) {
            lastOutputCountRef.current = ev.completed;
            void loadCanvas();
          }
        }
        if (ev.status === "failed") setJobFailed(true);
      },
      () => {
        void handleJobComplete();
      },
      () => {
        void trackEvent("generation_fail", {
          job_id: jobId,
          error_code: "STREAM_ERROR",
          duration_ms: Math.round(performance.now() - t0),
        });
        setJobFailed(true);
        setPollingJobId(null);
        setJobStreamStatus("failed");
      },
    );
    return stop;
  }, [pollingJobId, user, handleJobComplete]);

  useEffect(() => {
    const count = canvasItems.length;
    if (count > prevItemCountRef.current && prevItemCountRef.current > 0) {
      focusLatestCanvasItem();
    }
    prevItemCountRef.current = count;
  }, [canvasItems.length, focusLatestCanvasItem]);

  useEffect(() => {
    if (!pendingToolAfterSelect || !selectedCanvasId) return;
    const item = canvasItems.find((i) => i.id === selectedCanvasId);
    if (!item?.outputId) return;
    setActiveTool(pendingToolAfterSelect);
    setToolPrompt(pendingToolAfterSelect.defaultPrompt);
    setPendingToolAfterSelect(null);
    setSelectSourceBanner(null);
    setWorkbenchOpen(true);
  }, [pendingToolAfterSelect, selectedCanvasId, canvasItems]);

  function handleModeChange(next: CreationMode) {
    setMode(next);
    const params = new URLSearchParams(window.location.search);
    params.set("mode", next);
    params.set("sessionId", sessionId);
    window.history.replaceState(null, "", `/studio?${params.toString()}`);
  }

  function activateTool(tool: StudioTool) {
    if (tool.requiresSource) {
      const selected = canvasItems.find((i) => i.id === selectedCanvasId);
      if (!selected?.outputId) {
        setPendingToolAfterSelect(tool);
        setSelectSourceBanner("请先在画布点选一张图片作为参考");
        setWorkbenchOpen(mobile ? false : workbenchOpen);
        return;
      }
    }
    setActiveTool(tool);
    setToolPrompt(tool.defaultPrompt);
    setSelectSourceBanner(null);
    if (tool.clientOnly || mobile) setWorkbenchOpen(true);
  }

  async function handleRunTool() {
    if (!activeTool || !user) {
      setLoginOpen(true);
      return;
    }
    if (readOnly) return;

    if (activeTool.clientOnly) {
      setSelectSourceBanner("请使用画布底部工具栏进行裁剪");
      return;
    }

    const selected = canvasItems.find((i) => i.id === selectedCanvasId);
    const referenceOutputIds = selected?.outputId
      ? [selected.outputId]
      : undefined;

    if (activeTool.requiresSource && !referenceOutputIds?.length) {
      setSelectSourceBanner("请先在画布点选一张已生成的图片");
      setPendingToolAfterSelect(activeTool);
      return;
    }

    setToolPending(true);
    try {
      const { jobId } = await runTool(activeTool.id, {
        sessionId,
        prompt: toolPrompt.trim() || undefined,
        referenceOutputIds,
        resolution: resolveToolResolution(activeTool.id),
        ...(activeTool.id === "upscale" ? { scale: "2x" as const } : {}),
      });
      void trackEvent("tool_run", {
        tool_id: activeTool.id,
        job_id: jobId,
        has_reference: Boolean(referenceOutputIds?.length),
      });
      setPollingJobId(jobId);
      setActiveTool(null);
      setToolPrompt("");
      setSelectSourceBanner(null);
      await loadCanvas();
    } catch (err) {
      setSelectSourceBanner(
        err instanceof Error ? err.message : "工具执行失败",
      );
    } finally {
      setToolPending(false);
    }
  }

  async function handleQuickToolFromCanvas(
    item: CanvasItem,
    toolId: "cutout" | "expand",
  ) {
    const tool = tools.find((t) => t.id === toolId);
    if (!tool || !user || readOnly || !item.outputId) return;
    setSelectedCanvasId(item.id);
    setWorkbenchOpen(true);
    setToolPending(true);
    try {
      const { jobId } = await runTool(tool.id, {
        sessionId,
        prompt: tool.defaultPrompt,
        referenceOutputIds: [item.outputId],
        resolution: resolveToolResolution(tool.id),
      });
      setPollingJobId(jobId);
      setSelectSourceBanner(null);
    } catch (err) {
      setSelectSourceBanner(
        err instanceof Error ? err.message : "工具执行失败",
      );
    } finally {
      setToolPending(false);
    }
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
      const { id, url } = await uploadAsset(file, sessionId);
      setCanvasItems((prev) => [
        ...prev,
        createUploadCanvasItem(url, prev, { assetId: id, role: "product" }),
      ]);
      hapticLight();
    } catch (err) {
      setSelectSourceBanner(
        err instanceof Error ? err.message : "上传失败",
      );
    }
  }

  const handleAssignCanvasRole = useCallback(
    (itemId: string, role: CanvasItemRole) => {
      setCanvasItems((prev) => assignCanvasItemRole(prev, itemId, role));
      hapticLight();
    },
    [setCanvasItems],
  );

  function handleDeleteCanvasItem() {
    if (readOnly || !selectedCanvasId) return;
    setCanvasItems((prev) => prev.filter((i) => i.id !== selectedCanvasId));
    setSelectedCanvasId(null);
  }

  const handleTitleSaved = useCallback((title: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title } : s)),
    );
  }, [sessionId]);

  const handleSessionDeleted = useCallback(
    (deletedId?: string) => {
      const id = deletedId ?? sessionId;
      void listSessions(20, undefined, activeWorkspaceId ?? undefined).then(
        setSessions,
      );
      if (id === sessionId) {
        router.push(buildStudioUrl("canvas", { mode }));
      }
    },
    [sessionId, mode, router, activeWorkspaceId],
  );

  const showEmpty = messages.length === 0 && !pollingJobId;
  const isEcommerce = mode === "ecommerce";
  const selectedCanvasItem =
    selectedCanvasId ?
      (canvasItems.find((i) => i.id === selectedCanvasId) ?? null)
    : null;
  const canvasEmptyHint =
    mobile
      ? canvasEmptyHintMobile()
      : isEcommerce
        ? "上传商品图，生成结果将出现在画布"
        : "生成结果将显示在画布上";

  return (
    <>
      <AppLeftRail />
      <StudioHeader
        sessionId={user ? sessionId : undefined}
        sessionTitle={sessionTitle}
        sessionReadOnly={readOnly}
        onMenuClick={() => setSidebarOpen(true)}
        onTitleSaved={handleTitleSaved}
        onSessionDeleted={() => handleSessionDeleted()}
      />

      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onFileSelected(e)}
      />

      <StudioMobileCoach />

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
          className={`fixed inset-y-12 left-0 z-50 flex w-64 flex-col border-r border-white/5 bg-[#080808] p-3 transition-transform md:left-14 lg:static lg:z-0 lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-2 flex items-center justify-between lg:hidden">
            <span className="text-xs font-medium text-zinc-500">菜单</span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-1 text-zinc-500 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
          {user ? (
            <WorkspaceSwitcher onWorkspaceChange={handleWorkspaceChange} />
          ) : null}
          <p className="mb-2 mt-3 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            历史会话
          </p>
          <ul className="flex max-h-[40vh] flex-col gap-0.5 overflow-y-auto">
            {sessions.map((s) => (
              <li key={s.id} className="group">
                <Link
                  href={studioUrlForSession({
                    id: s.id,
                    mode: s.mode,
                    kind: s.kind,
                  })}
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
                    {SESSION_KIND_LABEL[s.kind === "project" ? "project" : "canvas"]}{" "}
                    · {s.mode}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <div className="relative flex min-h-0 min-w-0 flex-1 gap-0 p-3 md:p-4">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <p className="mb-2 shrink-0 px-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
              画布 · {sessionTitle}
              <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[9px] normal-case text-zinc-400">
                {SESSION_KIND_LABEL[sessionKind]}
              </span>
            </p>
            {sessionKind === "project" ? (
              <p className="mb-2 shrink-0 rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-1.5 text-xs text-purple-200/90">
                {mode === "ecommerce"
                  ? "交付项目 · 套图将逐张落在画布，完成后可导出或生成宣传短视频"
                  : "交付项目 · 电商出图归档于此，主图满意后可一键生成宣传短视频"}
              </p>
            ) : null}
            <ProviderStatusBanner />
            {readOnly ? (
              <p className="mb-2 shrink-0 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200/90">
                只读：他人会话，仅创建者或管理员可编辑与生成
              </p>
            ) : null}
            {inspirationApply ? (
              <InspirationSetGenerateBar
                sessionId={sessionId}
                canvasItems={canvasItems}
                prompt={inspirationApply.prompt}
                inspirationApply={inspirationApply}
                readOnly={readOnly}
                onJobStarted={(jobId) => setPollingJobId(jobId)}
              />
            ) : null}
            {selectedCanvasItem ? (
              <div className="mb-2 shrink-0">
                <CanvasRoleActions
                  item={selectedCanvasItem}
                  readOnly={readOnly}
                  onAssignRole={handleAssignCanvasRole}
                />
              </div>
            ) : null}
            <DesignCanvas
              ref={canvasRef}
              items={canvasItems}
              selectedId={selectedCanvasId}
              onSelect={(id) => {
                setSelectedCanvasId(id);
                if (id) hapticLight();
              }}
              onItemsChange={setCanvasItems}
              onUpload={handleCanvasUpload}
              onDownload={() => void handleCanvasDownload()}
              onDeleteSelected={handleDeleteCanvasItem}
              emptyHint={canvasEmptyHint}
              readOnly={readOnly}
              jobStreamStatus={jobStreamStatus}
              jobFailed={jobFailed}
              jobProgressCompleted={jobProgressCompleted}
              jobProgressTotal={jobProgressTotal}
              onOpenChatPanel={() => setWorkbenchOpen(true)}
              selectSourceBanner={selectSourceBanner}
              onCutoutItem={(item) => handleQuickToolFromCanvas(item, "cutout")}
              onExpandItem={(item) => handleQuickToolFromCanvas(item, "expand")}
            />
            {user ? (
              <div className="mt-2 px-1">
                <ContentReportDialog
                  sessionId={sessionId}
                  jobId={pollingJobId}
                />
              </div>
            ) : null}
          </div>

          <WorkbenchPanel
            open={workbenchOpen}
            onToggle={() => setWorkbenchOpen((o) => !o)}
            sessionTitle={sessionTitle}
            mode={mode}
            onModeChange={handleModeChange}
            sessionId={sessionId}
            initialPrompt={initialPrompt}
            restoredAssets={restoredAssets}
            inspirationApply={inspirationApply}
            messages={messages}
            showEmpty={showEmpty}
            pollingJobId={pollingJobId}
            jobStreamStatus={jobStreamStatus}
            tools={tools}
            activeTool={activeTool}
            toolPrompt={toolPrompt}
            toolPending={toolPending}
            onToolPromptChange={setToolPrompt}
            onToolSelect={activateTool}
            onToolCancel={() => {
              setActiveTool(null);
              setSelectSourceBanner(null);
              setPendingToolAfterSelect(null);
            }}
            onToolRun={() => void handleRunTool()}
            onAuthRequired={() => setLoginOpen(true)}
            onJobStarted={(jobId) => {
              setPollingJobId(jobId);
            }}
            userReady={Boolean(user && ready)}
            onLogin={() => setLoginOpen(true)}
            readOnly={readOnly}
          />
        </div>
      </div>

      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
