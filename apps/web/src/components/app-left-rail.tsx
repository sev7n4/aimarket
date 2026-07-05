"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Clock, Compass, Layers, PanelLeft, Plus } from "lucide-react";
import { BrandMarkIcon } from "@/components/brand-mark-icon";
import { LoginDialog } from "@/components/login-dialog";
import { RecentSessionsList } from "@/components/recent-sessions-list";
import { StudioWorkspaceFooter } from "@/components/studio-workspace-footer";
import { useRecentSessions } from "@/hooks/use-recent-sessions";
import { BRAND_NAME } from "@/lib/brand";
import { clientNavigate } from "@/lib/client-navigate";
import { buildStudioUrl } from "@/lib/studio-navigation";

/** 全局左轨宽度（与 pl-14 / left-14 一致） */
export const APP_LEFT_RAIL_WIDTH_CLASS = "w-14";
export const APP_LEFT_RAIL_PAD_CLASS = "lg:pl-14";

interface AppLeftRailProps {
  variant?: "home" | "studio";
  /** Studio 移动端：打开工作区侧栏 */
  onOpenWorkspace?: () => void;
  onLogin?: () => void;
}

interface RailItemProps {
  label: string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
  testId?: string;
  children: ReactNode;
}

function RailHoverLabel({ children }: { children: ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-[calc(100%+0.35rem)] top-1/2 z-[70] -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-[#121212] px-2.5 py-1 text-xs font-medium text-zinc-100 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
      {children}
    </span>
  );
}

function RailItem({
  label,
  onClick,
  href,
  active,
  testId,
  children,
}: RailItemProps) {
  const className = `group relative flex size-11 items-center justify-center rounded-xl transition ${
    active
      ? "bg-white/10 text-white"
      : "text-zinc-500 hover:bg-white/5 hover:text-zinc-100"
  }`;

  if (href) {
    return (
      <Link
        href={href}
        title={label}
        aria-label={label}
        data-testid={testId}
        className={className}
      >
        {children}
        <RailHoverLabel>{label}</RailHoverLabel>
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      data-testid={testId}
      className={className}
    >
      {children}
      <RailHoverLabel>{label}</RailHoverLabel>
    </button>
  );
}

/** 对标极梦：全站左侧图标导航（品牌 / 创作 / 最近 / 灵感 / 账户） */
export function AppLeftRail({
  variant = "home",
  onOpenWorkspace,
  onLogin,
}: AppLeftRailProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { sessions, loading } = useRecentSessions(15);
  const [recentOpen, setRecentOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const recentWrapRef = useRef<HTMLDivElement>(null);
  const recentCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openStudio = useCallback(() => {
    clientNavigate(
      router,
      buildStudioUrl("canvas", { title: "未命名", newDraft: false }),
    );
  }, [router]);

  const scrollHomeSection = useCallback(
    (sectionId: string, expandKits?: boolean) => {
      if (pathname !== "/") {
        const hash = sectionId === "inspiration-kits" ? "#inspiration-kits" : "#inspiration";
        clientNavigate(router, `/${hash}`);
        return;
      }
      if (expandKits) {
        document.dispatchEvent(new CustomEvent("aimarket:expand-inspiration-kits"));
      }
      requestAnimationFrame(() => {
        document.getElementById(sectionId)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    },
    [pathname, router],
  );

  const openRecent = useCallback(() => {
    if (recentCloseTimer.current) {
      clearTimeout(recentCloseTimer.current);
      recentCloseTimer.current = null;
    }
    setRecentOpen(true);
  }, []);

  const scheduleCloseRecent = useCallback(() => {
    if (recentCloseTimer.current) clearTimeout(recentCloseTimer.current);
    recentCloseTimer.current = setTimeout(() => setRecentOpen(false), 180);
  }, []);

  useEffect(() => {
    return () => {
      if (recentCloseTimer.current) clearTimeout(recentCloseTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!recentOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setRecentOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [recentOpen]);

  const handleLogin =
    onLogin ??
    (() => {
      setLoginOpen(true);
    });

  useEffect(() => {
    const openLogin = () => {
      if (onLogin) onLogin();
      else setLoginOpen(true);
    };
    document.addEventListener("aimarket:open-login", openLogin);
    return () =>
      document.removeEventListener("aimarket:open-login", openLogin);
  }, [onLogin]);

  return (
    <aside
      data-testid="app-left-rail"
      aria-label="主导航"
      className={`fixed left-0 top-0 z-[45] hidden h-dvh flex-col items-center border-r border-white/5 bg-[#050505] py-3 lg:flex ${APP_LEFT_RAIL_WIDTH_CLASS}`}
    >
      <Link
        href="/"
        className="group relative mb-3 flex size-11 items-center justify-center rounded-xl text-zinc-300 transition hover:bg-white/5 hover:text-white"
        aria-label={BRAND_NAME}
      >
        <BrandMarkIcon size="sm" />
        <RailHoverLabel>{BRAND_NAME}</RailHoverLabel>
      </Link>

      <nav className="flex flex-col items-center gap-1">
        <RailItem label="开始创作" onClick={openStudio}>
          <span className="flex size-9 items-center justify-center rounded-lg border border-dashed border-white/25 bg-white/[0.04]">
            <Plus className="size-4" />
          </span>
        </RailItem>

        <div
          ref={recentWrapRef}
          className="relative"
          onMouseEnter={openRecent}
          onMouseLeave={scheduleCloseRecent}
          onFocusCapture={openRecent}
          onBlurCapture={(e) => {
            if (!recentWrapRef.current?.contains(e.relatedTarget as Node)) {
              scheduleCloseRecent();
            }
          }}
        >
          <RailItem
            label="最近"
            active={recentOpen}
            testId="home-recent-rail-btn"
            onClick={openRecent}
          >
            <span className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
              <Clock className="size-4" />
            </span>
          </RailItem>

          {recentOpen ? (
            <div
              data-testid="home-recent-popover"
              role="dialog"
              aria-label="最近画布"
              className="absolute left-[calc(100%+0.5rem)] top-0 z-50 w-56 rounded-xl border border-white/10 bg-[#0c0c0c] p-3 shadow-xl"
              onMouseEnter={openRecent}
              onMouseLeave={scheduleCloseRecent}
            >
              <p className="mb-2 text-xs font-medium text-zinc-400">继续编辑</p>
              {loading ? (
                <p className="px-2 py-3 text-xs text-zinc-600">加载中…</p>
              ) : sessions.length > 0 ? (
                <RecentSessionsList
                  sessions={sessions}
                  variant="list"
                  showHeading={false}
                  useRouterPush
                  onNavigate={() => setRecentOpen(false)}
                />
              ) : (
                <p className="px-2 py-3 text-xs text-zinc-600">暂无最近画布</p>
              )}
            </div>
          ) : null}
        </div>

        <RailItem
          label="灵感发现"
          active={pathname === "/" && false}
          onClick={() => scrollHomeSection("inspiration")}
        >
          <span className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
            <Compass className="size-4" />
          </span>
        </RailItem>

        <RailItem
          label="灵感套件"
          onClick={() => scrollHomeSection("inspiration-kits", true)}
        >
          <span className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
            <Layers className="size-4" />
          </span>
        </RailItem>

        {variant === "studio" && onOpenWorkspace ? (
          <div className="lg:hidden">
            <RailItem label="工作区" onClick={onOpenWorkspace}>
              <span className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
                <PanelLeft className="size-4" />
              </span>
            </RailItem>
          </div>
        ) : null}
      </nav>

      <div className="mt-auto w-full px-1.5 pt-2">
        <StudioWorkspaceFooter collapsed onLogin={handleLogin} />
      </div>
      {!onLogin ? (
        <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
      ) : null}
    </aside>
  );
}
