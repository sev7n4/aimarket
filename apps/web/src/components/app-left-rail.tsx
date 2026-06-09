"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Clock, FolderKanban, LayoutGrid, Plus } from "lucide-react";
import { RecentSessionsList } from "@/components/recent-sessions-list";
import { useRecentSessions } from "@/hooks/use-recent-sessions";
import { buildStudioUrl, type StudioKind } from "@/lib/studio-navigation";

/** 对标椒图：首页左侧固定快捷栏（新建 / 最近 / 项目库） */
export function AppLeftRail() {
  const router = useRouter();
  const pathname = usePathname();
  const { sessions, loading } = useRecentSessions(3);
  const [recentOpen, setRecentOpen] = useState(false);
  const recentWrapRef = useRef<HTMLDivElement>(null);

  function openStudio(kind: StudioKind) {
    router.push(buildStudioUrl(kind));
  }

  useEffect(() => {
    if (!recentOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (
        recentWrapRef.current &&
        !recentWrapRef.current.contains(e.target as Node)
      ) {
        setRecentOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setRecentOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [recentOpen]);

  return (
    <aside
      data-testid="home-left-rail"
      aria-label="首页快捷导航"
      className="fixed left-0 top-14 z-40 hidden h-[calc(100dvh-3.5rem)] w-14 flex-col items-center gap-2 border-r border-white/5 bg-[#050505] py-4 md:flex"
    >
      <button
        type="button"
        onClick={() => openStudio("canvas")}
        title="新建画布"
        className="flex w-11 flex-col items-center gap-1 rounded-xl py-2 text-[10px] text-zinc-500 transition hover:bg-white/5 hover:text-white"
      >
        <span className="flex size-9 items-center justify-center rounded-lg border border-dashed border-white/20 bg-white/[0.03]">
          <Plus className="size-4" />
        </span>
        新建画布
      </button>

      <button
        type="button"
        onClick={() => openStudio("project")}
        title="新建项目"
        className="flex w-11 flex-col items-center gap-1 rounded-xl py-2 text-[10px] text-zinc-500 transition hover:bg-white/5 hover:text-white"
      >
        <span className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
          <LayoutGrid className="size-4" />
        </span>
        新建项目
      </button>

      <div ref={recentWrapRef} className="relative">
        <button
          type="button"
          data-testid="home-recent-rail-btn"
          title="最近"
          aria-expanded={recentOpen}
          aria-haspopup="dialog"
          onClick={() => setRecentOpen((v) => !v)}
          className={`flex w-11 flex-col items-center gap-1 rounded-xl py-2 text-[10px] transition hover:bg-white/5 hover:text-white ${
            recentOpen ? "bg-white/10 text-white" : "text-zinc-500"
          }`}
        >
          <span className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
            <Clock className="size-4" />
          </span>
          最近
        </button>

        {recentOpen ? (
          <div
            data-testid="home-recent-popover"
            role="dialog"
            aria-label="最近画布"
            className="absolute left-[calc(100%+0.5rem)] top-0 z-50 w-56 rounded-xl border border-white/10 bg-[#0c0c0c] p-3 shadow-xl"
          >
            <p className="mb-2 text-xs font-medium text-zinc-400">继续编辑</p>
            {loading ? (
              <p className="px-2 py-3 text-xs text-zinc-600">加载中…</p>
            ) : sessions.length > 0 ? (
              <RecentSessionsList
                sessions={sessions}
                variant="list"
                showHeading={false}
                onNavigate={() => setRecentOpen(false)}
              />
            ) : (
              <p className="px-2 py-3 text-xs text-zinc-600">暂无最近画布</p>
            )}
            <Link
              href="/projects"
              onClick={() => setRecentOpen(false)}
              className="mt-2 block rounded-lg px-2.5 py-2 text-center text-xs text-zinc-500 transition hover:bg-white/5 hover:text-orange-400"
            >
              查看全部
            </Link>
          </div>
        ) : null}
      </div>

      <Link
        href="/projects"
        title="项目库"
        className={`flex w-11 flex-col items-center gap-1 rounded-xl py-2 text-[10px] transition hover:bg-white/5 hover:text-white ${
          pathname === "/projects"
            ? "bg-white/10 text-white"
            : "text-zinc-500"
        }`}
      >
        <span className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
          <FolderKanban className="size-4" />
        </span>
        项目库
      </Link>
    </aside>
  );
}
