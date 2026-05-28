"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SessionTitleActions } from "@/components/session-title-actions";
import { InspirationSetGenerateBar } from "@/components/inspiration-set-generate-bar";
import { X } from "lucide-react";
import { LoginDialog } from "@/components/login-dialog";
import { AppLeftRail } from "@/components/app-left-rail";
import {
  DesignCanvas,
  type DesignCanvasHandle,
} from "@/components/design-canvas";
import { CreationPanel } from "@/components/creation-panel";
import { CanvasSelectionToolbar } from "@/components/canvas-selection-toolbar";
import { StudioHeader } from "@/components/studio-header";
import { ProviderStatusChip } from "@/components/provider-status-banner";
import { ContentReportDialog } from "@/components/content-report-dialog";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { StudioMobileCoach } from "@/components/studio-mobile-coach";
import { getActiveWorkspaceId } from "@/lib/active-workspace";
import { MOBILE_BREAKPOINT } from "@/lib/breakpoints";
import { resolveApiBase } from "@/lib/api-base";
import { trackEvent } from "@/lib/api-client";
import { type CreationMode } from "@aimarket/ui";
import type { ImageSession, StudioTool } from "@/lib/types";
import type { CanvasItem, CanvasMaskSelection } from "@/lib/canvas-tools";
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

type SelectionToolInteraction = "direct" | "brush" | "prompt";

const TOOL_INTERACTIONS: Record<string, SelectionToolInteraction> = {
  cutout: "direct",
  upscale: "direct",
  enhance: "direct",
  erase: "brush",
  inpaint: "brush",
  expand: "prompt",
  text: "prompt",
  blend: "prompt",
};

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
    default:
      return `${tool.defaultPrompt}，要求是：`;
  }
}

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
  const [restoredAssets, setRestoredAssets] = useState<PendingAsset[]>([]);
  const [inspirationApply, setInspirationApply] =
    useState<StudioInspirationApply | null>(null);
  const [selectSourceBanner, setSelectSourceBanner] = useState<string | null>(
    null,
  );
  const [jobFailed, setJobFailed] = useState(false);

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
    load: loadCanvas,
    canEdit: canvasCanEdit,
    setCanEdit,
  } = useSessionCanvas(sessionId, Boolean(user));
  const [sessions, setSessions] = useState<ImageSession[]>([]);
  const [tools, setTools] = useState<StudioTool[]>([]);
  const [ready, setReady] = useState(false);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [jobStreamStatus, setJobStreamStatus] = useState<string | null>(null);
  const [jobProgressCompleted, setJobProgressCompleted] = useState(0);
  const [jobProgressTotal, setJobProgressTotal] = useState(0);
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
  } | null>(null);
  /** 同款套图栏折叠态：默认折叠成 36px 单行 chip，紧贴 dock 顶部 */
  const [inspirationBarCollapsed, setInspirationBarCollapsed] = useState(true);
  /** 受控的内容举报对话框（StudioHeader 右上 ⚠ 触发） */
  const [reportOpen, setReportOpen] = useState(false);

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
    /**
     * 刷新恢复同款生成栏：
     * - 如果本次进入没有 pendingInspiration（用户刷新或跨设备打开），
     *   且后端 ensure 返回带有 sourceInspiration（取自 session.source_inspiration_id），
     *   就用它重建 inspirationApply，避免「同款套图栏」消失导致用户找不到入口。
     */
    if (!pendingInspiration && ensured.sourceInspiration) {
      const src = ensured.sourceInspiration;
      setInspirationApply({
        id: src.id,
        title: src.title,
        prompt: src.prompt,
        modelId: src.modelId,
        aspectRatio: coerceInspirationAspect(src.aspectRatio),
        resolution: src.resolution,
        variables: src.variables,
        variableValues: src.variableValues ?? {},
        referenceUrls: src.referenceUrls ?? [],
        applyKey: 1,
      });
    }
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
    if (!initialJobId || !user) return;
    setPollingJobId(initialJobId);
  }, [initialJobId, user]);

  useEffect(() => {
    if (!initialToolId || !tools.length) return;
    const tool = tools.find((t) => t.id === initialToolId);
    if (!tool) return;
    if (tool.requiresSource) {
      setSelectSourceBanner(`请先在画布点选一张图片，再运行 ${tool.name}`);
    }
  }, [initialToolId, tools]);

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
    if (count > prevItemCountRef.current) {
      if (prevItemCountRef.current === 0) {
        // 首次出现 items：自动适配全部，让默认进入即看见全图（治本默认 200px 小方块）
        window.requestAnimationFrame(() => canvasRef.current?.fitAll());
      } else {
        focusLatestCanvasItem();
      }
    }
    prevItemCountRef.current = count;
  }, [canvasItems.length, focusLatestCanvasItem]);

  /**
   * 同款栏折叠态切换时画布可视高度变化，自动 fit-all 重排。
   * 等待 transition 结束（约 1 帧 + 50ms 让布局稳定）。
   */
  useEffect(() => {
    if (canvasItems.length === 0) return;
    const t = window.setTimeout(() => canvasRef.current?.fitAll(), 80);
    return () => window.clearTimeout(t);
  }, [inspirationBarCollapsed, canvasItems.length]);

  async function handleQuickToolFromCanvas(
    item: CanvasItem,
    toolId: "cutout" | "expand",
  ) {
    const tool = tools.find((t) => t.id === toolId);
    if (!tool || !user || readOnly || !item.outputId) return;
    setSelectedCanvasId(item.id);
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
    }
  }

  /**
   * 选中画布图片后，从浮层 AI 工具栏一键跑工具。
   * - 优先 outputId（已生成图）；其次 assetId（上传图）。
   * - clientOnly 工具（如 crop）不在浮层显示，由画布原生工具栏承担。
   */
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

    const interaction = getToolInteraction(tool.id);
    if (interaction === "brush") {
      setBrushRequest((prev) => ({
        key: (prev?.key ?? 0) + 1,
        itemId: item.id,
        toolId: tool.id,
        toolName: tool.name,
      }));
      setSelectSourceBanner(
        `${tool.name}：请在图片上用手指/鼠标圈选区域，完成后再到工作台补充提示词。`,
      );
      hapticLight();
      return;
    }

    if (interaction === "prompt") {
      setMentionItemRequest((prev) => ({
        key: (prev?.key ?? 0) + 1,
        item,
        promptSuffix: buildToolPromptSuffix(tool),
      }));
      setSelectSourceBanner(
        `${tool.name} 需要结合提示词，已把当前图 @ 到工作台；补充要求后提交。`,
      );
      hapticLight();
      return;
    }

    const confirmed = window.confirm(
      `${tool.name} 会立即基于当前图片生成新图，确认执行？`,
    );
    if (!confirmed) return;

    setPendingToolId(tool.id);
    try {
      const { jobId } = await runTool(tool.id, {
        sessionId,
        prompt: tool.defaultPrompt,
        referenceOutputIds,
        assetIds,
        resolution: resolveToolResolution(tool.id),
        ...(tool.id === "upscale" ? { scale: "2x" as const } : {}),
      });
      void trackEvent("tool_run", {
        tool_id: tool.id,
        job_id: jobId,
        has_reference: true,
      });
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
        sessionKind={sessionKind}
        sessionReadOnly={readOnly}
        onMenuClick={() => setSidebarOpen(true)}
        onTitleSaved={handleTitleSaved}
        onSessionDeleted={() => handleSessionDeleted()}
        onReportClick={user ? () => setReportOpen(true) : undefined}
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

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-1 p-2 md:gap-1.5 md:p-3">
          {readOnly ? (
            <p className="shrink-0 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200/90">
              只读：他人会话，仅创建者或管理员可编辑与生成
            </p>
          ) : null}
          <DesignCanvas
            ref={canvasRef}
            items={canvasItems}
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
            emptyHint={canvasEmptyHint}
            readOnly={readOnly}
            jobStreamStatus={jobStreamStatus}
            jobFailed={jobFailed}
            jobProgressCompleted={jobProgressCompleted}
            jobProgressTotal={jobProgressTotal}
            selectSourceBanner={selectSourceBanner}
            onCutoutItem={(item) => handleQuickToolFromCanvas(item, "cutout")}
            onExpandItem={(item) => handleQuickToolFromCanvas(item, "expand")}
            brushRequest={brushRequest}
            onBrushCancel={() => {
              setBrushRequest(null);
              setSelectSourceBanner(null);
            }}
            onBrushComplete={(selection) => {
              const item = canvasItems.find((i) => i.id === selection.itemId);
              if (!item) return;
              const tool = tools.find((t) => t.id === selection.toolId);
              setBrushRequest(null);
              setMentionItemRequest((prev) => ({
                key: (prev?.key ?? 0) + 1,
                item,
                promptSuffix: buildToolPromptSuffix(
                  tool ?? {
                    id: selection.toolId,
                    name: "局部编辑",
                    description: "",
                    defaultPrompt: "请根据圈选区域进行局部编辑",
                  },
                ),
                maskSelection: selection,
              }));
              setSelectSourceBanner(
                "已完成圈选：区域 mask 已加入工作台，请补充提示词后提交。",
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
                onRunTool={(tool, item) => void handleRunSelectionTool(tool, item)}
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

          {/* 工作台 dock：与画布紧密贴合，常驻；按需向上叠加同款套图栏 */}
          <div className="shrink-0">
            {inspirationApply ? (
              <div className="mb-1.5">
                <InspirationSetGenerateBar
                  sessionId={sessionId}
                  canvasItems={canvasItems}
                  prompt={inspirationApply.prompt}
                  inspirationApply={inspirationApply}
                  readOnly={readOnly}
                  onJobStarted={(jobId) => setPollingJobId(jobId)}
                  collapsed={inspirationBarCollapsed}
                  onCollapsedChange={setInspirationBarCollapsed}
                />
              </div>
            ) : null}

            {!user || !ready ? (
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="mb-2 w-full text-center text-xs text-orange-400"
              >
                登录后开始创作
              </button>
            ) : null}
            {readOnly ? (
              <p className="mb-2 text-center text-xs text-amber-400/90">
                只读会话：无法在此生成或编辑
              </p>
            ) : null}
            <CreationPanel
              variant="dock"
              showModeTabs={false}
              rotatingPlaceholder
              enablePolish
              mode={mode}
              sessionId={sessionId}
              initialPrompt={initialPrompt}
              restoredAssets={restoredAssets}
              inspirationApply={inspirationApply}
              onAuthRequired={() => setLoginOpen(true)}
              onJobStarted={(jobId) => setPollingJobId(jobId)}
              jobStreamStatus={jobStreamStatus}
              readOnly={readOnly}
              canvasItems={canvasItems}
              mentionItemRequest={mentionItemRequest}
            />
          </div>
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
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
