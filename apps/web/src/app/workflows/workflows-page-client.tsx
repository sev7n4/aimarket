"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { AppLeftRail } from "@/components/app-left-rail";
import { CreateWorkflowButton } from "@/components/workflows/CreateWorkflowButton";
import { WorkflowCard } from "@/components/workflows/WorkflowCard";
import { listSessions } from "@/lib/api/sessions";
import { getActiveWorkspaceId } from "@/lib/active-workspace";
import { useAuth } from "@/lib/auth-context";
import type { ImageSession } from "@/lib/types";

export function WorkflowsPageClient() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ImageSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const loadSessions = useCallback(async () => {
    if (!user) {
      setSessions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await listSessions(100, "canvas", getActiveWorkspaceId() ?? undefined);
      setSessions(data);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const filteredSessions = sessions
    .filter((session) =>
      (session.title || "未命名工作流")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()),
    )
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );

  return (
    <div
      className="min-h-dvh bg-[#0f0f0f] text-zinc-100 lg:pl-14"
      data-testid="workflows-page"
    >
      <AppLeftRail variant="home" />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">工作流</h1>
            <p className="mt-1 text-sm text-zinc-500">
              个人画布 · 左无限画布 + 右 Agent 对话
            </p>
          </div>
          <label className="relative block w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索工作流"
              className="w-full rounded-lg border border-white/10 bg-[#141414] py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-white/20 focus:outline-none"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <CreateWorkflowButton />
          {loading
            ? Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="h-[228px] animate-pulse rounded-xl border border-white/5 bg-white/[0.03]"
                />
              ))
            : filteredSessions.map((session) => (
                <WorkflowCard key={session.id} session={session} />
              ))}
        </div>

        {!loading && user && filteredSessions.length === 0 ? (
          <p className="mt-6 text-center text-sm text-zinc-500">
            暂无工作流，点击「新建无限画布」开始创作
          </p>
        ) : null}

        {!user ? (
          <p className="mt-6 text-center text-sm text-zinc-500">
            登录后可同步云端工作流；未登录也可新建本地草稿
          </p>
        ) : null}
      </main>
    </div>
  );
}
