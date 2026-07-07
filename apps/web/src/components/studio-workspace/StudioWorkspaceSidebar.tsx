"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Flag, Plus, X } from "lucide-react";
import { SessionTitleActions } from "@/components/session-title-actions";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import type { ImageSession } from "@/lib/types";
import { type CreationMode } from "@aimarket/ui";
import { type SessionKind } from "@/lib/session-kind";
import { prefetchSessionCanvasBundle } from "@/hooks/use-session-canvas";
import { clientNavigate } from "@/lib/client-navigate";
import { studioUrlForSession } from "@/lib/studio-navigation";

export interface StudioWorkspaceSidebarProps {
  showTopBar: boolean;
  sidebarOpen: boolean;
  workspaceCollapsed: boolean;
  workspaceWidth: number;
  sessionId: string;
  sessionTitle: string;
  sessionKind: SessionKind;
  mode: CreationMode;
  readOnly: boolean;
  user: { id: string } | null;
  displaySessions: ImageSession[];
  onCloseSidebar: () => void;
  onCollapseWorkspace: () => void;
  onOpenReport: () => void;
  onNewStudio: () => void;
  onWorkspaceChange: (id: string) => void;
  onTitleSaved: (title: string) => void;
  onSessionDeleted: (deletedId?: string) => void;
  setSessions: React.Dispatch<React.SetStateAction<ImageSession[]>>;
}

export function StudioWorkspaceSidebar({
  showTopBar,
  sidebarOpen,
  workspaceCollapsed,
  workspaceWidth,
  sessionId,
  sessionTitle,
  sessionKind,
  mode,
  readOnly,
  user,
  displaySessions,
  onCloseSidebar,
  onCollapseWorkspace,
  onOpenReport,
  onNewStudio,
  onWorkspaceChange,
  onTitleSaved,
  onSessionDeleted,
  setSessions,
}: StudioWorkspaceSidebarProps) {
  const router = useRouter();

  return (
    <>
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          aria-label="关闭侧栏"
          onClick={onCloseSidebar}
        />
      ) : null}

      <aside
        style={workspaceCollapsed ? undefined : { width: workspaceWidth }}
        className={`fixed bottom-0 left-0 z-50 flex min-h-0 w-[min(85vw,280px)] flex-col border-r border-white/5 bg-[#080808] p-3 transition-all lg:left-14 ${
          showTopBar ? "top-12" : "top-0"
        } ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full pointer-events-none"
        } ${
          workspaceCollapsed
            ? "lg:hidden"
            : "lg:pointer-events-auto lg:static lg:top-auto lg:z-0 lg:m-2 lg:mr-0 lg:w-auto lg:translate-x-0 lg:rounded-2xl lg:border lg:bg-[#090909]/95"
        }`}
      >
        <div className="mb-2 flex items-center justify-between lg:hidden">
          <span className="text-xs font-medium text-zinc-500">工作区</span>
          <div className="flex items-center gap-1">
            {user && sessionId ? (
              <button
                type="button"
                onClick={onOpenReport}
                className="rounded-lg p-1.5 text-zinc-500 hover:text-amber-300"
                aria-label="举报违规内容"
                title="举报违规内容"
              >
                <Flag className="size-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onCloseSidebar}
              className="rounded-lg p-1 text-zinc-500 hover:text-white"
              title="关闭侧栏"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {!workspaceCollapsed ? (
          <button
            type="button"
            onClick={onCollapseWorkspace}
            className="mb-2 hidden size-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300 lg:flex"
            aria-label="收起工作区"
            title="收起工作区"
          >
            <ChevronLeft className="size-3.5" strokeWidth={1.75} />
          </button>
        ) : null}

        {!workspaceCollapsed && user && sessionId ? (
          <div className="mb-3 hidden border-b border-white/5 pb-3 lg:block">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <SessionTitleActions
                  sessionId={sessionId}
                  title={sessionTitle}
                  variant="header"
                  disabled={readOnly}
                  onTitleSaved={onTitleSaved}
                  onDeleted={() => onSessionDeleted()}
                />
                <div className="mt-1 flex items-center gap-2">
                  {sessionKind === "project" ? (
                    <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[9px] font-medium text-purple-300">
                      项目
                    </span>
                  ) : null}
                  <span className="text-[10px] text-zinc-600">
                    内容由 AI 生成
                  </span>
                </div>
              </div>
              {!readOnly ? (
                <button
                  type="button"
                  onClick={onOpenReport}
                  className="shrink-0 rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-amber-300"
                  aria-label="举报违规内容"
                  title="举报违规内容"
                >
                  <Flag className="size-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onCloseSidebar();
              onNewStudio();
            }}
            data-testid="studio-workspace-new"
            className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-black transition hover:bg-zinc-200"
          >
            <Plus className="size-3.5" />
            新建
          </button>
        </div>

        {user ? (
          <WorkspaceSwitcher onWorkspaceChange={onWorkspaceChange} />
        ) : null}

        <div className="mt-4 flex shrink-0 items-center justify-between">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            画布历史
          </p>
          <Link
            href={
              sessionId
                ? `/projects?from=studio&sessionId=${encodeURIComponent(sessionId)}&mode=${mode}&kind=${sessionKind}`
                : "/projects?from=studio"
            }
            onClick={onCloseSidebar}
            className="text-[10px] text-zinc-500 hover:text-orange-400"
          >
            查看全部
          </Link>
        </div>
        <ul className="mt-2 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain">
          {displaySessions.map((s) => (
            <li key={s.id} className="group">
              <Link
                href={studioUrlForSession({
                  id: s.id,
                  mode: s.mode,
                  kind: s.kind,
                })}
                data-testid={`studio-session-row-${s.id}`}
                onMouseEnter={() => prefetchSessionCanvasBundle(s.id)}
                onFocus={() => prefetchSessionCanvasBundle(s.id)}
                onClick={(e) => {
                  if (s.id === sessionId) {
                    e.preventDefault();
                    return;
                  }
                  e.preventDefault();
                  onCloseSidebar();
                  clientNavigate(
                    router,
                    studioUrlForSession({
                      id: s.id,
                      mode: s.mode,
                      kind: s.kind,
                    }),
                  );
                }}
                className={`block w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition ${
                  s.id === sessionId
                    ? "bg-white/10 text-white"
                    : "text-zinc-500 hover:bg-white/5"
                }`}
              >
                <SessionTitleActions
                  sessionId={s.id}
                  title={s.title}
                  variant="row"
                  disabled={!user || s.can_edit === false}
                  onTitleSaved={(title) => {
                    setSessions((prev) =>
                      prev.map((x) =>
                        x.id === s.id ? { ...x, title } : x,
                      ),
                    );
                  }}
                  onDeleted={() => onSessionDeleted(s.id)}
                />
                <div className="text-[10px] text-zinc-600">
                  {s.status === "draft" ? "草稿 · " : "画布 · "}
                  {s.mode}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}
