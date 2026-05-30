"use client";

import { useState } from "react";
import { X, UserPlus, Trash2 } from "lucide-react";
import { createWorkspaceInvite, removeWorkspaceMember, fetchWorkspaceMembers } from "@/lib/api-client";
import { useWorkspace } from "@/lib/workspace-context";

interface TeamSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function TeamSettingsDialog({ open, onClose }: TeamSettingsDialogProps) {
  const { activeWorkspace, activeWorkspaceId, members, refreshMembers } = useWorkspace();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open || !activeWorkspace || activeWorkspace.is_personal) return null;

  async function handleInvite() {
    if (!activeWorkspaceId) return;
    setLoading(true);
    try {
      const data = await createWorkspaceInvite(activeWorkspaceId);
      setInviteUrl(data.joinUrl);
      await navigator.clipboard.writeText(data.joinUrl);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!activeWorkspaceId) return;
    await removeWorkspaceMember(activeWorkspaceId, memberId);
    await refreshMembers();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0b0b] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">团队设置</h2>
            <p className="text-xs text-zinc-500">{activeWorkspace.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/10 hover:text-white"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-zinc-300">邀请成员</p>
            <button
              type="button"
              onClick={() => void handleInvite()}
              disabled={loading}
              className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-orange-500/10 px-3 py-2 text-sm text-orange-300 transition hover:bg-orange-500/20 disabled:opacity-50"
              title="生成邀请链接"
            >
              <UserPlus className="size-4" />
              生成邀请链接
            </button>
            {inviteUrl && (
              <p className="mt-2 break-all rounded bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400">
                链接已复制到剪贴板
              </p>
            )}
          </div>

          {members.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-zinc-300">成员列表</p>
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-white/5 bg-black/30 p-2">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm">
                    <span className="truncate text-zinc-300">{m.email}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">{m.role}</span>
                      {activeWorkspace.role === "owner" && m.role !== "owner" ? (
                        <button
                          type="button"
                          onClick={() => void handleRemoveMember(m.id)}
                          className="text-red-400/80 hover:text-red-300"
                          aria-label="移除成员"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
        >
          关闭
        </button>
      </div>
    </div>
  );
}