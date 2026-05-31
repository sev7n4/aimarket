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
import { CreationPanel } from "@/components/creation-panel";
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
import { trackEvent } from "@/lib/api-client";
import { type CreationMode } from "@aimarket/ui";
import type { ImageSession, StudioTool } from "@/lib/types";
import type { CanvasItem, CanvasMaskSelection } from "@/lib/canvas-tools";
import { useAuth } from "@/lib/auth-context";
import {
  assetUrl,
  cancelJob,
  ensureSession,
  exportSession,
  fetchJob,
  fetchTools,
  listSessions,
  recognizeFocusPoint,
  runTool,
  submitGeneration,
  uploadAsset,
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
import { useSessionCanvas } from "@/hooks/use-session-canvas";
import { watchJob } from "@/lib/job-stream";
import { consumePendingAssets, type PendingAsset } from "@/lib/pending-assets";
import { consumePendingInspiration } from "@/lib/pending-inspiration";
import { resolveToolResolution } from "@/lib/tool-resolution";
import { formatToolProviderLabel } from "@/lib/studio-tool-meta";
import { hapticLight } from "@/lib/haptics";
import { type SessionKind } from "@/lib/session-kind";
import { buildStudioUrl, studioUrlForSession } from "@/lib/studio-navigation";
import { useIsMobile } from "@/hooks/use-is-mobile";

type SelectionToolInteraction = "direct" | "brush" | "prompt" | "click";

const TOOL_INTERACTIONS: Record<string, SelectionToolInteraction> = {
  cutout: "direct",
  upscale: "direct",
  enhance: "direct",
  variation: "direct",
  erase: "brush",
  inpaint: "brush",
  "focus-edit": "click",
  expand: "prompt",
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
  } = useSessionCanvas(sessionId, Boolean(user));
  const [sessions, setSessions] = useState<ImageSession[]>([]);
  const [tools, setTools] = useState<StudioTool[]>([]);
  const [ready, setReady] = useState(false);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [jobStreamStatus, setJobStreamStatus] = useState<string | null>(null);
  const [jobProgressCompleted, setJobProgressCompleted] = useState(0);
  const [jobProgressTotal, setJobProgressTotal] = useState(0);
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
    void listSessions(20, undefined, id).then(setSessions);
  }, []);

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
     * 刷新恢复灵感注入：无 pendingInspiration 时，用 ensure 返回的 sourceInspiration
     * 重建 inspirationApply，以便 CreationPanel 继续预填 prompt / 参考图。
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
      setCanvasItems((prev) => [...prev, ...refItems]);
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
      setPollingJobId(jobId);
    },
    [registerBatchLineage],
  );

  const focusLatestCanvasItem = useCallback(() => {
    const target = pickLatestBatchFocusTarget(canvasItems);
    if (!target) return;
    setSelectedCanvasId(target.itemId);
    if (target.batchId) {
      canvasRef.current?.fitToBatch(target.batchId);
    } else {
      canvasRef.current?.fitToItem(target.itemId);
    }
    canvasRef.current?.pulseItem(target.itemId);
  }, [canvasItems]);

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
    setJobFailed(false);
    setPollingJobId(null);
    setJobStreamStatus(null);
    setJobProgressCompleted(0);
    setJobProgressTotal(0);
    lastOutputCountRef.current = 0;
    if (completedJobId) {
      try {
        const job = await fetchJob(completedJobId);
        if (job.tool_type && job.status === "succeeded") {
          const provider = formatToolProviderLabel(job.image_provider);
          if (provider) {
            setSelectSourceBanner(`精修完成 · ${provider}`);
          }
        }
      } catch {
        /* 忽略 provider 展示失败 */
      }
    }
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
        void handleJobComplete(jobId);
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
      focusLatestCanvasItem();
    }
    prevItemCountRef.current = count;
  }, [canvasItems.length, focusLatestCanvasItem]);

  /**
   * 同款栏折叠态切换时画布可视高度变化，自动 fit-all 重排。
   * 等待 transition 结束（约 1 帧 + 50ms 让布局稳定）。
   */
  useEffect(() => {
    if (canvasItems.length === 0) return;
    const t = window.setTimeout(() => focusLatestCanvasItem(), 80);
    return () => window.clearTimeout(t);
  }, [canvasItems.length, focusLatestCanvasItem]);

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
        tool.id === "text" && userPrompt
          ? `${tool.defaultPrompt}，新文字：${userPrompt}`
          : userPrompt || tool.defaultPrompt;
      const { jobId } = await runTool(tool.id, {
        sessionId,
        prompt,
        referenceOutputIds,
        assetIds,
        resolution: resolveToolResolution(tool.id),
        count: tool.id === "variation" ? opts.count : 1,
        ...(tool.id === "upscale"
          ? { scale: opts.scale ?? ("2x" as const) }
          : {}),
      });
      void trackEvent("tool_run", {
        tool_id: tool.id,
        job_id: jobId,
        has_reference: true,
        count: tool.id === "variation" ? opts.count : 1,
      });
      registerToolBatchLineage(jobId, item, tool.name);
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
      setBrushRequest({
        key: Date.now(),
        itemId: item.id,
        toolId: tool.id,
        toolName: tool.name,
        promptExtra: opts.prompt?.trim() || undefined,
      });
      setSelectSourceBanner(
        `${tool.name}：请在图片上圈选区域${opts.prompt?.trim() ? "，提示词已预填到工作台" : "，完成后再到工作台补充提示词"}。`,
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

  function handleUploadToCanvas(assetId: string, url: string) {
    if (readOnly) return;
    setCanvasItems((prev) => [
      ...prev,
      createUploadCanvasItem(url, prev, { assetId, role: "product" }),
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
          mode,
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
      setSelectSourceBanner(`任务已取消，积分已退回（${result.refundedPoints}积分）`);
      await refreshUser();
      await loadCanvas();
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
      void listSessions(20, undefined, activeWorkspaceId ?? undefined).then(
        setSessions,
      );
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

  const dockPanel = (
    <>
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
        embeddedInDock
        onDockModeChange={setDockMode}
        showModeTabs={false}
        rotatingPlaceholder
        enablePolish
        mode={mode}
        sessionId={sessionId}
        initialPrompt={initialPrompt}
        prompt={studioPrompt}
        onPromptChange={setStudioPrompt}
        restoredAssets={restoredAssets}
        inspirationApply={inspirationApply}
        onAuthRequired={() => setLoginOpen(true)}
        onJobStarted={handleJobStarted}
        jobStreamStatus={jobStreamStatus}
        pollingJobId={pollingJobId}
        onCancelJob={handleCancelJob}
        readOnly={readOnly}
        canvasItems={canvasItems}
        mentionItemRequest={mentionItemRequest}
        onUploadToCanvas={handleUploadToCanvas}
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
                          points: prev.points.filter((p) => p.pointId !== pointId),
                        }
                      : prev,
                  ),
                onEditPoint: (pointId, newName) =>
                  setFocusEditSession((prev) =>
                    prev
                      ? {
                          ...prev,
                          points: prev.points.map((p) =>
                            p.pointId === pointId ? { ...p, objectName: newName } : p,
                          ),
                        }
                      : prev,
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
          const referenceOutputIds = item.outputId ? [item.outputId] : undefined;
          const assetIds =
            !referenceOutputIds && item.assetId ? [item.assetId] : undefined;
          const { jobId } = await runTool("focus-edit", {
            sessionId,
            prompt: prompt.trim(),
            referenceOutputIds,
            assetIds,
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
          setPollingJobId(jobId);
          return jobId;
        }}
      />
    </>
  );

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
          className={`fixed bottom-0 left-0 z-50 flex w-[min(85vw,280px)] flex-col border-r border-white/5 bg-[#080808] p-3 transition-all ${
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

          <div className="mt-4 flex items-center justify-between">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
              最近创作
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
          <ul className="mt-2 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
            {sessions.slice(0, 3).map((s) => (
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
                    画布 · {s.mode}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <StudioWorkspaceFooter onLogin={() => setLoginOpen(true)} />
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
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            {readOnly ? (
              <p className="shrink-0 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200/90">
                只读：他人会话，仅创建者或管理员可编辑与生成
              </p>
            ) : null}
            <DesignCanvas
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
              jobProgressCompleted={jobProgressCompleted}
              jobProgressTotal={jobProgressTotal}
              selectSourceBanner={selectSourceBanner}
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
                  onDownload={() => void handleCanvasDownload()}
                  onDelete={handleDeleteCanvasItem}
                />
              }
              statusChip={<ProviderStatusChip />}
            />

            <StudioDock mode={dockMode} onModeChange={setDockMode}>
              {dockPanel}
            </StudioDock>
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
