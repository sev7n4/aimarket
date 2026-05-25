"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Maximize2, Minimize2, X } from "lucide-react";
import { CreationPanel } from "@/components/creation-panel";
import { LoginDialog } from "@/components/login-dialog";
import { AppLeftRail } from "@/components/app-left-rail";
import { StudioHeader } from "@/components/studio-header";
import { StudioToolGrid } from "@/components/studio-tool-grid";
import { ModeTabs, type CreationMode } from "@aimarket/ui";
import { modeTabs } from "@/lib/modes";
import type { ChatMessage, ImageSession, StudioTool } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import {
  assetUrl,
  ensureSession,
  exportSession,
  fetchMessages,
  fetchTools,
  listSessions,
  runTool,
} from "@/lib/api-client";
import { streamJob } from "@/lib/job-stream";

interface StudioWorkspaceProps {
  sessionId: string;
  initialMode: CreationMode;
  initialPrompt: string;
  initialJobId?: string;
  initialToolId?: string;
}

export function StudioWorkspace({
  sessionId,
  initialMode,
  initialPrompt,
  initialJobId,
  initialToolId,
}: StudioWorkspaceProps) {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [mode, setMode] = useState<CreationMode>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ImageSession[]>([]);
  const [tools, setTools] = useState<StudioTool[]>([]);
  const [activeTool, setActiveTool] = useState<StudioTool | null>(null);
  const [toolPrompt, setToolPrompt] = useState("");
  const [ready, setReady] = useState(false);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [toolPending, setToolPending] = useState(false);

  const currentSession = sessions.find((s) => s.id === sessionId);
  const sessionTitle =
    currentSession?.title && currentSession.title !== "未命名"
      ? currentSession.title
      : mode === "ecommerce"
        ? "电商套图"
        : "未命名";

  const loadMessages = useCallback(async () => {
    const data = await fetchMessages(sessionId);
    setMessages(data);
  }, [sessionId]);

  const initSession = useCallback(async () => {
    if (!user) return;
    await ensureSession(sessionId, mode);
    await loadMessages();
    const [list, toolList] = await Promise.all([
      listSessions(),
      fetchTools().catch(() => []),
    ]);
    setSessions(list);
    setTools(toolList);
    setReady(true);
  }, [user, sessionId, mode, loadMessages]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setReady(true);
      fetchTools().then(setTools).catch(() => setTools([]));
      return;
    }
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

  useEffect(() => {
    if (!pollingJobId || !user) return;
    const stop = streamJob(
      pollingJobId,
      () => {},
      async () => {
        setPollingJobId(null);
        await loadMessages();
        await refreshUser();
        setSessions(await listSessions());
      },
      () => setPollingJobId(null),
    );
    return stop;
  }, [pollingJobId, user, loadMessages, refreshUser]);

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
    setToolPending(true);
    try {
      const { jobId } = await runTool(activeTool.id, {
        sessionId,
        prompt: toolPrompt.trim() || undefined,
      });
      setPollingJobId(jobId);
      setActiveTool(null);
      setToolPrompt("");
      await loadMessages();
    } catch (err) {
      alert(err instanceof Error ? err.message : "工具执行失败");
    } finally {
      setToolPending(false);
    }
  }

  function toggleFullscreen() {
    const el = canvasRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      void el.requestFullscreen().then(() => setFullscreen(true));
    } else {
      void document.exitFullscreen().then(() => setFullscreen(false));
    }
  }

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const showEmpty = messages.length === 0 && !pollingJobId;
  const isEcommerce = mode === "ecommerce";

  return (
    <>
      <AppLeftRail />
      <StudioHeader
        sessionTitle={sessionTitle}
        onMenuClick={() => setSidebarOpen(true)}
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
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            历史会话
          </p>
          <div className="flex max-h-[40vh] flex-col gap-0.5 overflow-y-auto">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/studio?sessionId=${s.id}&mode=${s.mode}`}
                onClick={() => setSidebarOpen(false)}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  s.id === sessionId
                    ? "bg-white/10 text-white"
                    : "text-zinc-500 hover:bg-white/5"
                }`}
              >
                <div className="truncate font-medium">{s.title}</div>
                <div className="text-[10px] text-zinc-600">{s.mode}</div>
              </Link>
            ))}
          </div>
          {user ? (
            <button
              type="button"
              onClick={async () => {
                const data = await exportSession(sessionId);
                for (const f of data.files) {
                  window.open(
                    f.url.startsWith("http")
                      ? f.url
                      : `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}${f.url}`,
                    "_blank",
                  );
                }
                if (!data.files.length) alert("暂无可导出文件");
              }}
              className="mt-4 text-left text-xs text-zinc-500 hover:text-zinc-300"
            >
              导出本会话全部图片
            </button>
          ) : null}
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col p-3 md:p-4">
          <div
            ref={canvasRef}
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3">
              <span className="text-sm font-medium text-zinc-200">
                {sessionTitle}
              </span>
              <div className="flex items-center gap-1">
                {user ? null : ready ? (
                  <button
                    type="button"
                    onClick={() => setLoginOpen(true)}
                    className="mr-2 text-xs text-orange-400 hover:underline"
                  >
                    登录后开始
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                  aria-label={fullscreen ? "退出全屏" : "全屏"}
                >
                  {fullscreen ? (
                    <Minimize2 className="size-4" />
                  ) : (
                    <Maximize2 className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex shrink-0 justify-center border-b border-white/5 px-4 py-3">
              <ModeTabs
                items={modeTabs}
                value={mode}
                onChange={handleModeChange}
                className="max-w-full overflow-x-auto"
              />
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6">
              {activeTool ? (
                <div className="mx-auto mb-4 w-full max-w-2xl rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4">
                  <h3 className="font-medium text-purple-200">
                    {activeTool.name}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    {activeTool.description}
                  </p>
                  <textarea
                    value={toolPrompt}
                    onChange={(e) => setToolPrompt(e.target.value)}
                    rows={2}
                    className="mt-3 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRunTool()}
                      disabled={toolPending}
                      className="rounded-full bg-gradient-to-r from-orange-500 to-purple-600 px-4 py-1.5 text-sm font-medium disabled:opacity-50"
                    >
                      {toolPending ? "执行中…" : "运行工具"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTool(null)}
                      className="text-sm text-zinc-500 hover:text-zinc-300"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : null}

              {showEmpty ? (
                <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
                  {isEcommerce ? (
                    <>
                      <span className="text-5xl" aria-hidden>
                        🎨
                      </span>
                      <h2 className="mt-6 text-2xl font-semibold tracking-tight text-white">
                        电商套图 Agent
                      </h2>
                      <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-500">
                        上传商品图并填写卖点，一句话生成主图、卖点、场景、详情
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-4xl" aria-hidden>
                        😊
                      </p>
                      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
                        Hi，我是 AIMarket
                      </h2>
                      <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-500">
                        说说今天你想做点什么，一句话让我帮你创作！
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
                  {messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}
                </div>
              )}

              {pollingJobId ? (
                <div className="mx-auto mt-4 flex w-full max-w-3xl items-center gap-2 text-sm text-zinc-500">
                  <Loader2 className="size-4 animate-spin text-orange-400" />
                  正在生成中…
                </div>
              ) : null}
            </div>

            <div className="shrink-0 border-t border-white/5 bg-[#0a0a0a] px-4 py-4">
              <CreationPanel
                variant="dock"
                showModeTabs={false}
                rotatingPlaceholder
                mode={mode}
                onModeChange={handleModeChange}
                sessionId={sessionId}
                initialMode={initialMode}
                initialPrompt={initialPrompt}
                onAuthRequired={() => setLoginOpen(true)}
                onJobStarted={(jobId) => {
                  setPollingJobId(jobId);
                  void loadMessages();
                }}
              />
              {mode !== "ecommerce" ? (
                <StudioToolGrid
                  tools={tools}
                  activeToolId={activeTool?.id}
                  disabled={toolPending || Boolean(pollingJobId)}
                  onSelect={(tool) => {
                    setActiveTool(tool);
                    setToolPrompt(tool.defaultPrompt);
                  }}
                />
              ) : null}
            </div>
          </div>
        </main>
      </div>

      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const slideLabels = ["主图", "卖点", "场景", "详情"];

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm sm:max-w-[85%] ${
          isUser
            ? "bg-white/10 text-zinc-100"
            : "border border-white/8 bg-white/[0.03] text-zinc-200"
        }`}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        {message.outputs?.length > 0 ? (
          <div
            className={`mt-3 gap-2 ${
              message.outputs.length >= 4
                ? "grid grid-cols-2"
                : "grid grid-cols-1 sm:grid-cols-2"
            }`}
          >
            {message.outputs.map((out, i) => {
              const isVideo =
                out.url.includes(".mp4") || out.url.includes("video");
              return (
                <a
                  key={`${out.url}-${i}`}
                  href={assetUrl(out.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="group overflow-hidden rounded-xl border border-white/10 bg-black/40"
                >
                  {message.outputs.length === 4 ? (
                    <span className="block bg-black/60 px-2 py-1 text-[10px] text-zinc-400">
                      {slideLabels[i] ?? `图 ${i + 1}`}
                    </span>
                  ) : null}
                  {isVideo ? (
                    <video
                      src={assetUrl(out.url)}
                      controls
                      className="aspect-video w-full bg-black object-contain"
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={assetUrl(out.url)}
                      alt="生成结果"
                      className="aspect-square w-full object-cover transition group-hover:scale-[1.02]"
                    />
                  )}
                </a>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
