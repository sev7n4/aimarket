"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Plus, Rows3 } from "lucide-react";
import { AppLeftRail } from "@/components/app-left-rail";
import { SessionTitleActions } from "@/components/session-title-actions";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { listSessions } from "@/lib/api-client";
import { getActiveWorkspaceId } from "@/lib/active-workspace";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { SESSION_KIND_LABEL, type SessionKind } from "@/lib/session-kind";
import { buildStudioUrl, studioUrlForSession } from "@/lib/studio-navigation";
import { useAuth } from "@/lib/auth-context";
import type { ImageSession } from "@/lib/types";

const modeLabel: Record<string, string> = {
  chat: "对话",
  quick: "快速",
  ecommerce: "电商套图",
};

type FilterKind = "all" | SessionKind;

const tabs: { id: FilterKind; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "canvas", label: "画布" },
  { id: "project", label: "项目" },
];

export default function ProjectsPage() {
  const { user, loading } = useAuth();
  const [sessions, setSessions] = useState<ImageSession[]>([]);
  const [filter, setFilter] = useState<FilterKind>("all");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const loadSessions = useCallback(() => {
    if (!user) return;
    const kind = filter === "all" ? undefined : filter;
    const wsId = workspaceId ?? getActiveWorkspaceId() ?? undefined;
    listSessions(50, kind, wsId)
      .then(setSessions)
      .catch(() => setSessions([]));
  }, [user, filter, workspaceId]);

  useEffect(() => {
    if (!user) return;
    const stored = getActiveWorkspaceId();
    if (stored) setWorkspaceId(stored);
  }, [user]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return (
    <div className="min-h-dvh md:pl-14">
      <AppLeftRail />
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">项目库</h1>
          <div className="flex gap-2">
            <Link
              href={buildStudioUrl("canvas")}
              className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
            >
              <Plus className="size-4" />
              新建画布
            </Link>
            <Link
              href={buildStudioUrl("project")}
              className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-purple-600 px-4 py-2 text-sm font-medium text-white"
            >
              <LayoutGrid className="size-4" />
              新建项目
            </Link>
          </div>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          画布用于单轮创作，项目可长期管理多轮会话
        </p>

        {user ? (
          <div className="mt-4 max-w-xs">
            <WorkspaceSwitcher onWorkspaceChange={setWorkspaceId} />
          </div>
        ) : null}

        <div className="mt-6 flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-lg px-4 py-2 text-sm transition ${
                filter === tab.id
                  ? "bg-white/10 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

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
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-orange-500/30 hover:bg-white/[0.06]"
              >
                <Link
                  href={studioUrlForSession({
                    id: s.id,
                    mode: s.mode,
                    kind: s.kind,
                  })}
                  className="block p-4"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        s.kind === "project"
                          ? "bg-purple-500/20 text-purple-200"
                          : "bg-zinc-700/50 text-zinc-400"
                      }`}
                    >
                      {SESSION_KIND_LABEL[s.kind === "project" ? "project" : "canvas"]}
                    </span>
                    {s.mode === "ecommerce" ? (
                      <span className="text-[10px] text-orange-400/80">套图</span>
                    ) : null}
                  </div>
                  <SessionTitleActions
                    sessionId={s.id}
                    title={s.title}
                    variant="card"
                    disabled={s.can_edit === false}
                    onTitleSaved={(title) => {
                      setSessions((prev) =>
                        prev.map((x) =>
                          x.id === s.id ? { ...x, title } : x,
                        ),
                      );
                    }}
                    onDeleted={loadSessions}
                  />
                  <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
                    <Rows3 className="size-3" />
                    {modeLabel[s.mode] ?? s.mode} ·{" "}
                    {new Date(s.updated_at).toLocaleString("zh-CN")}
                  </p>
                </Link>
              </li>
            ))}
            {user && sessions.length === 0 ? (
              <li className="col-span-full py-12 text-center text-zinc-500">
                {filter === "all"
                  ? "暂无记录，点击上方按钮开始创作"
                  : `暂无${SESSION_KIND_LABEL[filter]}，点击新建`}
              </li>
            ) : null}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
