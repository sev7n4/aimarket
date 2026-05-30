"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, FileText, History, Plus, Wand2 } from "lucide-react";
import { listSessions } from "@/lib/api-client";
import { getActiveWorkspaceId } from "@/lib/active-workspace";
import { buildStudioUrl, studioUrlForSession } from "@/lib/studio-navigation";
import { useAuth } from "@/lib/auth-context";
import type { ImageSession } from "@/lib/types";

interface StartCreateDialogProps {
  open: boolean;
  onClose: () => void;
}

export function StartCreateDialog({ open, onClose }: StartCreateDialogProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ImageSession[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRecentSessions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const wsId = getActiveWorkspaceId() ?? undefined;
      const recent = await listSessions(10, undefined, wsId);
      setSessions(recent);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (open) {
      void loadRecentSessions();
    }
  }, [open, loadRecentSessions]);

  function handleCreateNew() {
    router.push(buildStudioUrl("canvas"));
    onClose();
  }

  function handleContinueSession(session: ImageSession) {
    router.push(studioUrlForSession({
      id: session.id,
      mode: session.mode,
      kind: session.kind,
    }));
    onClose();
  }

  function handleFromInspiration() {
    router.push("/inspiration");
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0b0b] p-6 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-full bg-gradient-to-r from-orange-500 to-orange-400 p-2">
            <Sparkles className="size-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">开始创作</h2>
            <p className="text-xs text-zinc-500">选择创作方式</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleCreateNew}
            className="w-full flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-orange-500/30 hover:bg-orange-500/10"
          >
            <Plus className="size-5 text-orange-400" />
            <div>
              <p className="text-sm font-medium text-white">创建新画布</p>
              <p className="text-xs text-zinc-500">从空白画布开始创作</p>
            </div>
          </button>

          <button
            type="button"
            onClick={handleFromInspiration}
            className="w-full flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-orange-500/30 hover:bg-orange-500/10"
          >
            <Wand2 className="size-5 text-purple-400" />
            <div>
              <p className="text-sm font-medium text-white">从模板/灵感开始</p>
              <p className="text-xs text-zinc-500">选择灵感套图快速复刻</p>
            </div>
          </button>

          {sessions.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
                <History className="size-3.5" />
                继续最近的画布
              </p>
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-white/5 bg-black/30 p-2">
                {sessions.slice(0, 5).map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => handleContinueSession(s)}
                      className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/5"
                    >
                      <FileText className="size-4 text-zinc-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-zinc-200">{s.title}</p>
                        <p className="text-[10px] text-zinc-600">
                          {new Date(s.updated_at).toLocaleDateString("zh-CN")}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {loading && (
            <p className="text-center text-xs text-zinc-500">加载中...</p>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
        >
          取消
        </button>
      </div>
    </div>
  );
}