"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Crop,
  Eraser,
  Expand,
  Film,
  Layers,
  Loader2,
  Palette,
  Pencil,
  Type,
  Wand2,
} from "lucide-react";
import { CreationPanel } from "@/components/creation-panel";
import { LoginDialog } from "@/components/login-dialog";
import type { CreationMode } from "@aimarket/ui";
import type { ChatMessage, ImageSession, StudioTool } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import {
  assetUrl,
  ensureSession,
  fetchJob,
  fetchMessages,
  fetchTools,
  listSessions,
  runTool,
} from "@/lib/api-client";

const TOOL_ICONS: Record<string, typeof Expand> = {
  expand: Expand,
  erase: Eraser,
  inpaint: Pencil,
  text: Type,
  crop: Crop,
  blend: Layers,
};

interface StudioWorkspaceProps {
  sessionId: string;
  initialMode: CreationMode;
  initialPrompt: string;
}

export function StudioWorkspace({
  sessionId,
  initialMode,
  initialPrompt,
}: StudioWorkspaceProps) {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ImageSession[]>([]);
  const [tools, setTools] = useState<StudioTool[]>([]);
  const [activeTool, setActiveTool] = useState<StudioTool | null>(null);
  const [toolPrompt, setToolPrompt] = useState("");
  const [ready, setReady] = useState(false);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [toolPending, setToolPending] = useState(false);

  const loadMessages = useCallback(async () => {
    const data = await fetchMessages(sessionId);
    setMessages(data);
  }, [sessionId]);

  const initSession = useCallback(async () => {
    if (!user) return;
    await ensureSession(sessionId, initialMode);
    await loadMessages();
    const [list, toolList] = await Promise.all([
      listSessions(),
      fetchTools().catch(() => []),
    ]);
    setSessions(list);
    setTools(toolList);
    setReady(true);
  }, [user, sessionId, initialMode, loadMessages]);

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
    if (!pollingJobId || !user) return;
    const timer = setInterval(async () => {
      try {
        const job = await fetchJob(pollingJobId);
        if (job.status === "succeeded" || job.status === "failed") {
          setPollingJobId(null);
          await loadMessages();
          await refreshUser();
          setSessions(await listSessions());
        }
      } catch {
        setPollingJobId(null);
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [pollingJobId, user, loadMessages, refreshUser]);

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

  const isEcommerce = initialMode === "ecommerce";
  const showEmpty = messages.length === 0 && !pollingJobId;

  return (
    <>
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-4 px-4 py-6">
        <aside className="hidden w-52 shrink-0 flex-col gap-3 lg:flex">
          <div className="text-xs font-medium uppercase tracking-wider text-zinc-600">
            历史会话
          </div>
          <div className="flex max-h-[32vh] flex-col gap-1 overflow-y-auto">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/studio?sessionId=${s.id}&mode=${s.mode}`}
                className={`rounded-lg px-3 py-2 text-left text-sm transition ${
                  s.id === sessionId
                    ? "bg-white/10 text-white"
                    : "text-zinc-500 hover:bg-white/5"
                }`}
              >
                <div className="truncate font-medium">{s.title}</div>
                <div className="text-xs text-zinc-600">{s.mode}</div>
              </Link>
            ))}
          </div>
          <div className="text-xs font-medium uppercase tracking-wider text-zinc-600">
            AI 工具
          </div>
          <div className="flex flex-col gap-1">
            {initialMode === "ecommerce" ? (
              <button
                type="button"
                className="flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-300"
              >
                <Palette className="size-3.5" />
                套图模式
              </button>
            ) : null}
            {tools.map((tool) => {
              const Icon = TOOL_ICONS[tool.id] ?? Wand2;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => {
                    setActiveTool(tool);
                    setToolPrompt(tool.defaultPrompt);
                  }}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition ${
                    activeTool?.id === tool.id
                      ? "border-purple-500/40 bg-purple-500/10 text-white"
                      : "border-white/10 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                  }`}
                >
                  <Icon className="size-3.5 shrink-0" />
                  {tool.name}
                </button>
              );
            })}
          </div>
        </aside>

        <div className="flex min-h-[50vh] min-w-0 flex-1 flex-col">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
              <span className="text-zinc-500">项目 · </span>
              <span className="font-medium">
                {isEcommerce ? "电商套图" : "未命名"}
              </span>
              <span className="ml-2 text-xs text-zinc-600">内容由 AI 生成</span>
            </div>
            {!user && ready ? (
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="text-sm text-orange-400 hover:underline"
              >
                登录后开始创作
              </button>
            ) : null}
          </div>

          {activeTool ? (
            <div className="mb-3 rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4">
              <h3 className="font-medium text-purple-200">{activeTool.name}</h3>
              <p className="mt-1 text-xs text-zinc-500">{activeTool.description}</p>
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

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto rounded-3xl border border-white/10 bg-white/[0.02] p-4">
            {showEmpty ? (
              <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                {isEcommerce ? (
                  <>
                    <span className="text-4xl" aria-hidden>
                      🎨
                    </span>
                    <h2 className="mt-4 text-2xl font-semibold">套图模式</h2>
                    <p className="mt-2 max-w-md text-sm text-zinc-500">
                      上传商品图并填写卖点，一键生成 4 张电商套图
                    </p>
                  </>
                ) : (
                  <>
                    <Wand2 className="size-10 text-orange-400/80" />
                    <h2 className="mt-4 text-2xl font-semibold">
                      Hi，我是 AIMarket
                    </h2>
                    <p className="mt-2 max-w-md text-sm text-zinc-500">
                      对话改图、@ 引用历史图，或使用左侧 AI 工具
                    </p>
                  </>
                )}
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))
            )}
            {pollingJobId ? (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Loader2 className="size-4 animate-spin text-orange-400" />
                正在生成中…
              </div>
            ) : null}
          </div>

          <div className="mt-4">
            <CreationPanel
              compact
              sessionId={sessionId}
              initialMode={initialMode}
              initialPrompt={initialPrompt}
              onAuthRequired={() => setLoginOpen(true)}
              onJobStarted={(jobId) => {
                setPollingJobId(jobId);
                void loadMessages();
              }}
            />
          </div>
        </div>
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
        className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? "bg-gradient-to-br from-orange-600/80 to-purple-700/80 text-white"
            : "border border-white/10 bg-white/[0.04] text-zinc-200"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.outputs?.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {message.outputs.map((out, i) => (
              <a
                key={`${out.url}-${i}`}
                href={assetUrl(out.url)}
                target="_blank"
                rel="noreferrer"
                className="group block overflow-hidden rounded-xl border border-white/10"
              >
                {message.outputs.length === 4 ? (
                  <span className="block bg-black/50 px-2 py-1 text-[10px] text-zinc-400">
                    {slideLabels[i] ?? `图 ${i + 1}`}
                  </span>
                ) : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={assetUrl(out.url)}
                  alt="生成结果"
                  className="aspect-square w-full object-cover transition group-hover:scale-[1.02]"
                />
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
