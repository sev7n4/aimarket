"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FolderKanban, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

/** 对标椒图：左侧固定快捷栏（新建画布 / 项目库） */
export function AppLeftRail() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  function newCanvas() {
    const id = crypto.randomUUID();
    router.push(`/studio?sessionId=${id}&mode=chat`);
  }

  return (
    <aside className="fixed left-0 top-14 z-40 hidden h-[calc(100dvh-3.5rem)] w-14 flex-col items-center gap-2 border-r border-white/5 bg-[#050505] py-4 md:flex">
      <button
        type="button"
        onClick={newCanvas}
        title="新建画布"
        className="flex w-11 flex-col items-center gap-1 rounded-xl py-2 text-[10px] text-zinc-500 transition hover:bg-white/5 hover:text-white"
      >
        <span className="flex size-9 items-center justify-center rounded-lg border border-dashed border-white/20 bg-white/[0.03]">
          <Plus className="size-4" />
        </span>
        新建画布
      </button>

      <Link
        href={user ? "/projects" : "/studio"}
        onClick={(e) => {
          if (!user) {
            e.preventDefault();
            document.dispatchEvent(new Event("aimarket:open-login"));
          }
        }}
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
