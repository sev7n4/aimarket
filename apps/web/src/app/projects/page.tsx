"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, Rows3, Search, Trash2, ArrowUpDown, Check } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SessionTitleActions } from "@/components/session-title-actions";
import { listSessions, deleteSession } from "@/lib/api-client";
import { getActiveWorkspaceId } from "@/lib/active-workspace";
import { studioUrlForSession } from "@/lib/studio-navigation";
import { useAuth } from "@/lib/auth-context";
import type { ImageSession } from "@/lib/types";

const modeLabel: Record<string, string> = {
  chat: "对话",
  quick: "快速",
  ecommerce: "电商套图",
};

type SortOption = "updated" | "created" | "title";

export default function ProjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const [sessions, setSessions] = useState<ImageSession[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("updated");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const workspaceId = searchParams.get("workspaceId") ?? getActiveWorkspaceId() ?? undefined;

  const loadSessions = useCallback(async () => {
    if (!user) return;
    try {
      const data = await listSessions(100, undefined, workspaceId);
      setSessions(data);
    } catch {
      setSessions([]);
    }
  }, [user, workspaceId]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const filteredSessions = sessions
    .filter((s) => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "updated") {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
      if (sortBy === "created") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return a.title.localeCompare(b.title, "zh-CN");
    });

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredSessions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSessions.map((s) => s.id)));
    }
  }

  async function handleBatchDelete() {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      for (const id of selectedIds) {
        await deleteSession(id);
      }
      setSelectedIds(new Set());
      await loadSessions();
    } finally {
      setDeleting(false);
    }
  }

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
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索画布..."
                  className="w-full rounded-lg border border-white/10 bg-black/40 pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-orange-500/50 focus:outline-none"
                />
              </div>

              <div className="relative">
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
                >
                  <ArrowUpDown className="size-4" />
                  排序
                </button>
                <div className="absolute right-0 top-full z-10 mt-1 rounded-lg border border-white/10 bg-[#0b0b0b] p-1 shadow-xl">
                  {[
                    { value: "updated", label: "最近更新" },
                    { value: "created", label: "创建时间" },
                    { value: "title", label: "名称" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSortBy(opt.value as SortOption)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                        sortBy === opt.value
                          ? "bg-orange-500/20 text-orange-300"
                          : "text-zinc-300 hover:bg-white/5"
                      }`}
                    >
                      {sortBy === opt.value && <Check className="size-3" />}
                      <span className={sortBy === opt.value ? "" : "ml-5"}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => void handleBatchDelete()}
                  disabled={deleting}
                  className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                  删除 ({selectedIds.size})
                </button>
              )}
            </div>

            {filteredSessions.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  {selectedIds.size === filteredSessions.length ? (
                    <Check className="size-3.5" />
                  ) : (
                    <div className="size-3.5 rounded border border-zinc-500" />
                  )}
                  全选
                </button>
                <p className="text-xs text-zinc-500">
                  共 {filteredSessions.length} 个画布
                </p>
              </div>
            )}

            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {filteredSessions.map((s) => (
                <li
                  key={s.id}
                  className={`group relative rounded-2xl border transition ${
                    selectedIds.has(s.id)
                      ? "border-orange-500/50 bg-orange-500/10"
                      : "border-white/10 bg-white/[0.03] hover:border-orange-500/30 hover:bg-white/[0.06]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSelect(s.id)}
                    className={`absolute left-2 top-2 z-10 flex size-5 items-center justify-center rounded-lg border transition ${
                      selectedIds.has(s.id)
                        ? "border-orange-500 bg-orange-500 text-white"
                        : "border-white/20 bg-black/40 text-transparent hover:border-white/40"
                    }`}
                  >
                    <Check className="size-3" />
                  </button>
                  <Link
                    href={studioUrlForSession({
                      id: s.id,
                      mode: s.mode,
                      kind: s.kind,
                    })}
                    className="block p-4 pl-10"
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
              {user && filteredSessions.length === 0 ? (
                <li className="col-span-full py-12 text-center text-zinc-500">
                  {searchQuery ? "未找到匹配的画布" : "暂无画布，点击上方按钮开始创作"}
                </li>
              ) : null}
            </ul>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}