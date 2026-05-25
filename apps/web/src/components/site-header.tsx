"use client";

import Link from "next/link";
import { Menu, Gift } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@aimarket/ui";
import { useAuth } from "@/lib/auth-context";
import { LoginDialog } from "@/components/login-dialog";
import { CreditsDialog } from "@/components/credits-dialog";
import { MobileNavDrawer } from "@/components/mobile-nav-drawer";
import { fetchSignStatus, signIn } from "@/lib/api-client";

export function SiteHeader() {
  const { user, logout, loading, refreshUser } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [signedToday, setSignedToday] = useState(true);
  const [signing, setSigning] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  async function handleSignIn() {
    if (!user) {
      setLoginOpen(true);
      return;
    }
    setSigning(true);
    try {
      const res = await signIn();
      setSignedToday(true);
      await refreshUser();
      alert(res.message);
    } catch (err) {
      alert(err instanceof Error ? err.message : "签到失败");
    } finally {
      setSigning(false);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white lg:hidden"
              aria-label="打开菜单"
            >
              <Menu className="size-5" />
            </button>
            <Link
              href="/"
              className="flex items-center gap-2 font-semibold tracking-tight"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-purple-600 text-sm font-bold text-white">
                AM
              </span>
              <span>AIMarket</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {!loading && user ? (
              <>
                <button
                  type="button"
                  onClick={() => void handleSignIn()}
                  disabled={signedToday || signing}
                  className="hidden rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-40 sm:inline"
                >
                  {signedToday ? "已签到" : signing ? "签到中…" : "每日签到"}
                </button>
                <button
                  type="button"
                  onClick={() => setCreditsOpen(true)}
                  className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs text-orange-200 hover:bg-orange-500/20"
                >
                  积分 {user.credits}
                </button>
                <Link
                  href="/settings"
                  className="hidden rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400 hover:text-white sm:inline"
                >
                  品牌
                </Link>
                <Link
                  href="/invite"
                  className="hidden items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400 hover:text-white sm:inline-flex"
                >
                  <Gift className="size-3.5" />
                  邀请
                </Link>
                <Button variant="ghost" onClick={logout}>
                  退出
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setLoginOpen(true)}>
                  登录
                </Button>
                <Button variant="primary" onClick={() => setLoginOpen(true)}>
                  免费开始
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      <MobileNavDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
      <CreditsDialog open={creditsOpen} onClose={() => setCreditsOpen(false)} />
    </>
  );
}
