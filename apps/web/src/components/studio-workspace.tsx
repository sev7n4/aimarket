"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SessionTitleActions } from "@/components/session-title-actions";
import { X } from "lucide-react";
import { LoginDialog } from "@/components/login-dialog";
import { AppLeftRail } from "@/components/app-left-rail";
import { DesignCanvas } from "@/components/design-canvas";
import { WorkbenchPanel } from "@/components/workbench-panel";
import { StudioHeader } from "@/components/studio-header";
import { ProviderStatusBanner } from "@/components/provider-status-banner";
import { ContentReportDialog } from "@/components/content-report-dialog";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { getActiveWorkspaceId } from "@/lib/active-workspace";
import { resolveApiBase } from "@/lib/api-base";
import { trackEvent } from "@/lib/api-client";
import { type CreationMode } from "@aimarket/ui";
import type { ImageSession, StudioTool } from "@/lib/types";
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
import { useSessionCanvas } from "@/hooks/use-session-canvas";
import { watchJob } from "@/lib/job-stream";
import { SESSION_KIND_LABEL, type SessionKind } from "@/lib/session-kind";
import { buildStudioUrl, studioUrlForSession } from "@/lib/studio-navigation";

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
  const { user, loading: authLoading, refreshUser } = useAuth();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [workbenchOpen, setWorkbenchOpen] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setWorkbenchOpen(false);
    }
  }, []);
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
      : initialTitle ??
        (mode === "ecommerce" ? "电商套图" : "未命名");

  const initSession = useCallback(async () => {
    if (!user) return;
    const wsId = activeWorkspaceId ?? getActiveWorkspaceId() ?? undefined;
    const ensured = await ensureSession(sessionId, mode, {
      title: initialTitle,
      kind: initialKind ?? "canvas",
      workspaceId: wsId,
    });
    setCanEdit(ensured.can_edit ?? true);
    await loadCanvas();
    const [list, toolList] = await Promise.all([
      listSessions(20, undefined, wsId),
      fetchTools().catch(() => []),
    ]);
    setSessions(list);
    setTools(toolList);
    setReady(true);
  }, [user, sessionId, mode, initialTitle, initialKind, loadCanvas, activeWorkspaceId, setCanEdit]);

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
    setPollingJobId(initialJobId);
  }, [initialJobId, user]);

  useEffect(() => {
    if (!initialToolId || !tools.length) return;
    const tool = tools.find((t) => t.id === initialToolId);
    if (tool) {
      setActiveTool(tool);
      setToolPrompt(tool.defaultPrompt);
    }
  }, [initialToolId, tools]);

  const handleJobComplete = useCallback(async () => {
    setPollingJobId(null);
    setJobStreamStatus(null);
    await loadCanvas();
    await refreshUser();
    setSessions(
      await listSessions(20, undefined, activeWorkspaceId ?? undefined),
    );
  }, [loadCanvas, refreshUser, activeWorkspaceId]);

  useEffect(() => {
    if (!pollingJobId || !user) return;
    const t0 = performance.now();
    const jobId = pollingJobId;
    setJobStreamStatus("queued");
    const stop = watchJob(
      jobId,
      (ev) => setJobStreamStatus(ev.status),
      () => {
        void handleJobComplete();
      },
      () => {
        void trackEvent("generation_fail", {
          job_id: jobId,
          error_code: "STREAM_ERROR",
          duration_ms: Math.round(performance.now() - t0),
        });
        setPollingJobId(null);
        setJobStreamStatus(null);
      },
    );
    return stop;
  }, [pollingJobId, user, handleJobComplete]);

  function handleModeChange(next: CreationMode) {
    setMode(next);
    const params = new URLSearchParams(window.location.search);
    params.set("mode", next);
    params.set("sessionId", sessionId);
    window.history.replaceState(null, "", `/studio?${params.toString()}`);
  }

  async function handleRunTool() {
    if (!activeTool || !user) {
      setLoginOpen(true);
      return;
    }
    if (readOnly) return;

    if (activeTool.clientOnly) {
      alert("请在左侧画布选中图片后使用裁剪（画布工具栏），无需调用 AI 出图");
      return;
    }

    const selected = canvasItems.find((i) => i.id === selectedCanvasId);
    const referenceOutputIds =
      selected?.outputId ? [selected.outputId] : undefined;

    if (activeTool.requiresSource && !referenceOutputIds?.length) {
      alert("请先在画布选择一张已生成的图片，或上传参考图后再运行");
      return;
    }

    setToolPending(true);
    try {
      const { jobId } = await runTool(activeTool.id, {
        sessionId,
        prompt: toolPrompt.trim() || undefined,
        referenceOutputIds,
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
      await loadCanvas();
    } catch (err) {
      alert(err instanceof Error ? err.message : "工具执行失败");
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
        f.url.startsWith("http")
          ? f.url
          : `${resolveApiBase()}${f.url}`,
        "_blank",
      );
    }
    if (!data.files.length) alert("暂无可下载内容");
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
      const { url } = await uploadAsset(file, sessionId);
      setCanvasItems((prev) => [
        ...prev,
        createUploadCanvasItem(url, prev),
      ]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "上传失败");
    }
  }

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
    [sessionId, mode, router],
  );

  const showEmpty = messages.length === 0 && !pollingJobId;
  const isEcommerce = mode === "ecommerce";
  const canvasEmptyHint = isEcommerce
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
        className="hidden"
        onChange={(e) => void onFileSelected(e)}
      />

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
                        prev.map((x) => (x.id === s.id ? { ...x, title } : x)),
                      );
                    }}
                    onDeleted={() => handleSessionDeleted(s.id)}
                  />
                  <div className="text-[10px] text-zinc-600">
                    {SESSION_KIND_LABEL[s.kind === "project" ? "project" : "canvas"]}{" "}
                    · {s.mode}
                    {s.creator_email && s.user_id !== user?.id ? (
                      <span className="ml-1 text-zinc-500">
                        · {s.creator_email}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <div className="relative flex min-h-0 min-w-0 flex-1 gap-0 p-3 md:p-4">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <p className="mb-2 shrink-0 px-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
              画布区 · {sessionTitle}
              <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[9px] normal-case text-zinc-400">
                {SESSION_KIND_LABEL[sessionKind]}
              </span>
            </p>
            <ProviderStatusBanner />
            {readOnly ? (
              <p className="mb-2 shrink-0 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200/90">
                只读：他人会话，仅创建者或管理员可编辑与生成
              </p>
            ) : null}
            <DesignCanvas
              items={canvasItems}
              selectedId={selectedCanvasId}
              onSelect={setSelectedCanvasId}
              onItemsChange={setCanvasItems}
              onUpload={handleCanvasUpload}
              onDownload={() => void handleCanvasDownload()}
              onDeleteSelected={handleDeleteCanvasItem}
              emptyHint={canvasEmptyHint}
              readOnly={readOnly}
            />
            {user ? (
              <div className="mt-2 px-1">
                <ContentReportDialog sessionId={sessionId} jobId={pollingJobId} />
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
            messages={messages}
            showEmpty={showEmpty}
            pollingJobId={pollingJobId}
            jobStreamStatus={jobStreamStatus}
            tools={tools}
            activeTool={activeTool}
            toolPrompt={toolPrompt}
            toolPending={toolPending}
            onToolPromptChange={setToolPrompt}
            onToolSelect={(tool) => {
              setActiveTool(tool);
              setToolPrompt(tool.defaultPrompt);
              if (tool.clientOnly) {
                setWorkbenchOpen(true);
              }
            }}
            onToolCancel={() => setActiveTool(null)}
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
