"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Rows3 } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SessionTitleActions } from "@/components/session-title-actions";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { listSessions } from "@/lib/api-client";
import { getActiveWorkspaceId } from "@/lib/active-workspace";
import { studioUrlForSession } from "@/lib/studio-navigation";
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
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    if (!user) return;
    const wsId = workspaceId ?? getActiveWorkspaceId() ?? undefined;
    try {
      const data = await listSessions(50, undefined, wsId);
      setSessions(data);
    } catch {
      setSessions([]);
    }
  }, [user, workspaceId]);

  useEffect(() => {
    if (!user) return;
    const stored = getActiveWorkspaceId();
    if (stored) setWorkspaceId(stored);
  }, [user]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

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
          <div className="mt-4 max-w-xs">
            <WorkspaceSwitcher onWorkspaceChange={setWorkspaceId} />
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