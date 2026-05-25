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
import type { ChatMessage, ImageSession } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import {
  assetUrl,
  ensureSession,
  fetchJob,
  fetchMessages,
  listSessions,
} from "@/lib/api-client";

const tools = [
  { name: "套图模式", icon: Palette },
  { name: "图片裁剪", icon: Crop },
  { name: "AI 智能消除", icon: Eraser },
  { name: "多图融合", icon: Layers },
  { name: "AI 扩图", icon: Expand },
  { name: "无痕改字", icon: Type },
  { name: "局部修改", icon: Pencil },
  { name: "视频生成", icon: Film },
] as const;

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
  const [ready, setReady] = useState(false);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    const data = await fetchMessages(sessionId);
    setMessages(data);
  }, [sessionId]);

  const initSession = useCallback(async () => {
    if (!user) return;
    await ensureSession(sessionId, initialMode);
    await loadMessages();
    const list = await listSessions();
    setSessions(list);
    setReady(true);
  }, [user, sessionId, initialMode, loadMessages]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setReady(true);
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
          const list = await listSessions();
          setSessions(list);
        }
      } catch {
        setPollingJobId(null);
      }
    }, 1500);

    return () => clearInterval(timer);
  }, [pollingJobId, user, loadMessages, refreshUser]);

  const isEcommerce = initialMode === "ecommerce";
  const showEmpty = messages.length === 0 && !pollingJobId;

  return (
    <>
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-4 px-4 py-6">
        <aside className="hidden w-52 shrink-0 flex-col gap-3 lg:flex">
          <div className="text-xs font-medium uppercase tracking-wider text-zinc-600">
            历史会话
          </div>
          <div className="flex max-h-[40vh] flex-col gap-1 overflow-y-auto">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/studio?sessionId=${s.id}&mode=${s.mode}`}
                className={`rounded-lg px-3 py-2 text-left text-sm transition ${
                  s.id === sessionId
                    ? "bg-white/10 text-white"
                    : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                }`}
              >
                <div className="truncate font-medium">{s.title}</div>
                <div className="text-xs text-zinc-600">{s.mode}</div>
              </Link>
            ))}
            {!sessions.length && user ? (
              <p className="text-xs text-zinc-600">暂无历史</p>
            ) : null}
          </div>
          <div className="mt-auto flex flex-col gap-2">
            {tools.map((tool) => (
              <button
                key={tool.name}
                type="button"
                title={tool.name}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-500"
                disabled
              >
                <tool.icon className="size-3.5" />
                {tool.name}
              </button>
            ))}
          </div>
        </aside>

        <div className="flex min-h-[50vh] min-w-0 flex-1 flex-col">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
              <span className="text-zinc-500">项目 · </span>
              <span className="font-medium">未命名</span>
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
                      上传商品图，一键生成套图方案（Phase 2 完整上线）
                    </p>
                  </>
                ) : (
                  <>
                    <Wand2 className="size-10 text-orange-400/80" />
                    <h2 className="mt-4 text-2xl font-semibold">
                      Hi，我是 AIMarket
                    </h2>
                    <p className="mt-2 max-w-md text-sm text-zinc-500">
                      输入修改描述或上传图片，Ctrl+Enter 快速提交
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

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
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
                className="block overflow-hidden rounded-xl border border-white/10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={assetUrl(out.url)}
                  alt="生成结果"
                  className="aspect-square w-full object-cover"
                />
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
