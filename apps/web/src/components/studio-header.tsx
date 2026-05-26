"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FolderOpen, Home, Menu, Plus } from "lucide-react";
import { buildStudioUrl } from "@/lib/studio-navigation";
import { useAuth } from "@/lib/auth-context";
import { LoginDialog } from "@/components/login-dialog";
import { CreditsDialog } from "@/components/credits-dialog";
import { SessionTitleActions } from "@/components/session-title-actions";
import { fetchSignStatus, getToken, signIn } from "@/lib/api-client";

interface StudioHeaderProps {
  sessionId?: string;
  sessionTitle?: string;
  onMenuClick?: () => void;
  onTitleSaved?: (title: string) => void;
  onSessionDeleted?: () => void;
  sessionReadOnly?: boolean;
}

export function StudioHeader({
  sessionId,
  sessionTitle = "未命名",
  onMenuClick,
  onTitleSaved,
  onSessionDeleted,
  sessionReadOnly = false,
}: StudioHeaderProps) {
  const router = useRouter();
  const { user, logout, loading, refreshUser } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [signedToday, setSignedToday] = useState(true);

  useEffect(() => {
    const openLogin = () => setLoginOpen(true);
    document.addEventListener("aimarket:open-login", openLogin);
    return () =>
      document.removeEventListener("aimarket:open-login", openLogin);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchSignStatus()
      .then((s) => setSignedToday(s.signedToday))
      .catch(() => setSignedToday(true));
  }, [user]);

  function newProject() {
    router.push(buildStudioUrl("project"));
  }

  return (
    <>
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/5 bg-[#030303] px-3 md:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onMenuClick}
            className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="打开侧栏"
          >
            <Menu className="size-5" />
          </button>
          <Link
            href="/"
            className="flex shrink-0 items-center justify-center rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white sm:hidden"
            aria-label="返回首页"
            title="返回首页"
          >
            <Home className="size-5" />
          </Link>
          <Link
            href="/"
            className="hidden rounded-lg px-2 py-1 text-sm font-semibold text-zinc-300 hover:text-white sm:inline"
          >
            AIMarket
          </Link>
          <div className="group flex min-w-0 max-w-[min(100%,280px)] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 sm:max-w-xs">
            <FolderOpen className="size-4 shrink-0 text-zinc-500" />
            <div className="min-w-0 flex-1">
              {sessionId && user ? (
                <SessionTitleActions
                  sessionId={sessionId}
                  title={sessionTitle}
                  variant="header"
                  disabled={sessionReadOnly}
                  onTitleSaved={onTitleSaved}
                  onDeleted={onSessionDeleted}
                />
              ) : (
                <p className="truncate text-sm font-medium text-zinc-100">
                  {sessionTitle}
                </p>
              )}
              <p className="truncate text-[10px] text-zinc-600">
                内容由 AI 生成
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={newProject}
            className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
            aria-label="新建项目"
            title="新建项目"
          >
            <Plus className="size-5" />
          </button>
          {!loading && user ? (
            <>
              <button
                type="button"
                onClick={() => void signIn().then(() => refreshUser())}
                disabled={signedToday}
                className="hidden rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-zinc-400 hover:text-white disabled:opacity-40 sm:inline"
              >
                {signedToday ? "已签到" : "签到"}
              </button>
              <button
                type="button"
                onClick={() => setCreditsOpen(true)}
                className="rounded-full border border-orange-500/25 bg-orange-500/10 px-2.5 py-1 text-xs text-orange-200"
              >
                {user.credits} 积分
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-purple-600 text-xs font-bold text-white"
                title={user.email}
              >
                {user.email[0]?.toUpperCase() ?? "U"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="rounded-full bg-gradient-to-r from-orange-500 to-purple-600 px-3 py-1 text-xs font-medium text-white"
            >
              登录
            </button>
          )}
        </div>
      </header>
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
      <CreditsDialog open={creditsOpen} onClose={() => setCreditsOpen(false)} />
    </>
  );
}
