"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Rows3, User, Users } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SessionTitleActions } from "@/components/session-title-actions";
import { listSessions, fetchWorkspaces } from "@/lib/api-client";
import { getActiveWorkspaceId, setActiveWorkspaceId } from "@/lib/active-workspace";
import { studioUrlForSession } from "@/lib/studio-navigation";
import { useAuth } from "@/lib/auth-context";
import type { ImageSession } from "@/lib/types";

type Workspace = {
  id: string;
  name: string;
  is_personal: number;
  role: string;
};

const modeLabel: Record<string, string> = {
  chat: "对话",
  quick: "快速",
  ecommerce: "电商套图",
};

export default function ProjectsPage() {
  const { user, loading } = useAuth();
  const [sessions, setSessions] = useState<ImageSession[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWsId] = useState<string | null>(null);
  const [spaceFilter, setSpaceFilter] = useState<"personal" | "team">("personal");

  const loadWorkspaces = useCallback(async () => {
    if (!user) return;
    try {
      const ws = await fetchWorkspaces();
      setWorkspaces(ws);
      const stored = getActiveWorkspaceId();
      const personal = ws.find((w) => w.is_personal);
      if (stored && ws.some((w) => w.id === stored)) {
        setActiveWsId(stored);
      } else if (personal) {
        setActiveWsId(personal.id);
        setActiveWorkspaceId(personal.id);
      }
    } catch {
      setWorkspaces([]);
    }
  }, [user]);

  const loadSessions = useCallback(async () => {
    if (!user || !activeWorkspaceId) return;
    try {
      const data = await listSessions(50, undefined, activeWorkspaceId);
      setSessions(data);
    } catch {
      setSessions([]);
    }
  }, [user, activeWorkspaceId]);

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  function handleSpaceFilterChange(filter: "personal" | "team") {
    setSpaceFilter(filter);
    const target = workspaces.find((w) =>
      filter === "personal" ? w.is_personal : !w.is_personal
    );
    if (target) {
      setActiveWsId(target.id);
      setActiveWorkspaceId(target.id);
    }
  }

  const personalWorkspace = workspaces.find((w) => w.is_personal);
  const teamWorkspaces = workspaces.filter((w) => !w.is_personal);

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-white">项目库</h1>
          <Link
            href="/studio?kind=canvas&title=新建画布"
            className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-orange-500/25 transition hover:from-orange-600 hover:to-orange-500"
          >
            <Plus className="size-4" />
            新建画布
          </Link>
        </div>

        {user ? (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => handleSpaceFilterChange("personal")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                spaceFilter === "personal"
                  ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                  : "bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10"
              }`}
            >
              <User className="size-4" />
              个人空间
            </button>
            <button
              type="button"
              onClick={() => handleSpaceFilterChange("team")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                spaceFilter === "team"
                  ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                  : "bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10"
              }`}
            >
              <Users className="size-4" />
              团队空间
            </button>
          </div>
        ) : null}

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
                暂无画布，点击上方按钮开始创作
              </li>
            ) : null}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}