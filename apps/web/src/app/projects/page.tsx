"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AppLeftRail } from "@/components/app-left-rail";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { listSessions } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { ImageSession } from "@/lib/types";

const modeLabel: Record<string, string> = {
  chat: "对话",
  quick: "快速",
  ecommerce: "电商套图",
};

export default function ProjectsPage() {
  const { user, loading } = useAuth();
  const [sessions, setSessions] = useState<ImageSession[]>([]);

  useEffect(() => {
    if (!user) return;
    listSessions(50)
      .then(setSessions)
      .catch(() => setSessions([]));
  }, [user]);

  return (
    <div className="min-h-dvh md:pl-14">
      <AppLeftRail />
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">项目库</h1>
          <Link
            href={`/studio?sessionId=${crypto.randomUUID()}&mode=chat`}
            className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-purple-600 px-4 py-2 text-sm font-medium text-white"
          >
            <Plus className="size-4" />
            新建画布
          </Link>
        </div>
        <p className="mt-1 text-sm text-zinc-500">你的历史创作会话</p>

        {!loading && !user ? (
          <p className="mt-12 text-center text-zinc-500">
            请先{" "}
            <button
              type="button"
              className="text-orange-400 hover:underline"
              onClick={() =>
                document.dispatchEvent(new Event("aimarket:open-login"))
              }
            >
              登录
            </button>{" "}
            查看项目
          </p>
        ) : (
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/studio?sessionId=${s.id}&mode=${s.mode}`}
                  className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-orange-500/30 hover:bg-white/[0.06]"
                >
                  <p className="font-medium">{s.title}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {modeLabel[s.mode] ?? s.mode} ·{" "}
                    {new Date(s.updated_at).toLocaleString("zh-CN")}
                  </p>
                </Link>
              </li>
            ))}
            {user && sessions.length === 0 ? (
              <li className="col-span-full py-12 text-center text-zinc-500">
                暂无项目，点击「新建画布」开始创作
              </li>
            ) : null}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
