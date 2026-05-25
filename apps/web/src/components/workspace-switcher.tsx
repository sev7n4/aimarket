"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@aimarket/ui";
import {
  createWorkspace,
  createWorkspaceInvite,
  fetchWorkspaceMembers,
  fetchWorkspaces,
  removeWorkspaceMember,
} from "@/lib/api-client";
import {
  getActiveWorkspaceId,
  setActiveWorkspaceId,
} from "@/lib/active-workspace";

type Workspace = {
  id: string;
  name: string;
  is_personal: number;
  role: string;
};

type Member = {
  id: string;
  email: string;
  role: string;
};

interface WorkspaceSwitcherProps {
  onWorkspaceChange?: (workspaceId: string) => void;
}

export function WorkspaceSwitcher({ onWorkspaceChange }: WorkspaceSwitcherProps) {
  const onWorkspaceChangeRef = useRef(onWorkspaceChange);
  onWorkspaceChangeRef.current = onWorkspaceChange;

  const [list, setList] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [teamName, setTeamName] = useState("");

  const active = list.find((w) => w.id === activeId) ?? list[0];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const workspaces = await fetchWorkspaces();
      setList(workspaces);
      const stored = getActiveWorkspaceId();
      const next =
        stored && workspaces.some((w) => w.id === stored)
          ? stored
          : workspaces.find((w) => w.is_personal)?.id ?? workspaces[0]?.id;
      if (next) {
        setActiveId(next);
        setActiveWorkspaceId(next);
        onWorkspaceChangeRef.current?.(next);
        if (!workspaces.find((w) => w.id === next)?.is_personal) {
          const m = await fetchWorkspaceMembers(next);
          setMembers(m);
        } else {
          setMembers([]);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSelect(id: string) {
    setActiveId(id);
    setActiveWorkspaceId(id);
    setInviteUrl(null);
    onWorkspaceChangeRef.current?.(id);
    const ws = list.find((w) => w.id === id);
    if (ws && !ws.is_personal) {
      setMembers(await fetchWorkspaceMembers(id));
    } else {
      setMembers([]);
    }
  }

  async function handleCreateTeam() {
    const name = teamName.trim() || "团队工作区";
    const ws = await createWorkspace(name);
    setTeamName("");
    await load();
    await handleSelect(ws.id);
  }

  async function handleInvite() {
    if (!activeId || active?.is_personal) return;
    const data = await createWorkspaceInvite(activeId);
    setInviteUrl(data.joinUrl);
    try {
      await navigator.clipboard.writeText(data.joinUrl);
    } catch {
      /* ignore */
    }
  }

  if (!list.length) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs">
      <p className="font-medium text-zinc-400">工作区</p>
      <select
        value={activeId ?? ""}
        onChange={(e) => void handleSelect(e.target.value)}
        disabled={loading}
        className="mt-2 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-1.5 text-sm text-zinc-200"
      >
        {list.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
            {w.is_personal ? "（个人）" : ""}
          </option>
        ))}
      </select>

      <div className="mt-2 flex flex-wrap gap-2">
        <input
          type="text"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="新团队名称"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-zinc-300"
        />
        <Button
          type="button"
          variant="ghost"
          className="shrink-0 text-xs"
          onClick={() => void handleCreateTeam()}
        >
          新建团队
        </Button>
      </div>

      {active && !active.is_personal ? (
        <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
          <Button
            type="button"
            variant="primary"
            className="w-full text-xs"
            onClick={() => void handleInvite()}
          >
            生成邀请链接
          </Button>
          {inviteUrl ? (
            <p className="break-all text-[10px] text-emerald-400/90">
              已复制：{inviteUrl}
            </p>
          ) : null}
          {members.length > 0 ? (
            <ul className="max-h-28 space-y-1 overflow-y-auto text-[10px] text-zinc-500">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{m.email}</span>
                  <span className="shrink-0">{m.role}</span>
                  {active.role === "owner" && m.role !== "owner" ? (
                    <button
                      type="button"
                      className="text-red-400/80 hover:text-red-300"
                      onClick={() => {
                        if (!activeId) return;
                        void removeWorkspaceMember(activeId, m.id).then(() =>
                          fetchWorkspaceMembers(activeId).then(setMembers),
                        );
                      }}
                    >
                      移除
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
