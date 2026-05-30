"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { User, Users, ChevronDown, Plus } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [showTeamCreate, setShowTeamCreate] = useState(false);
  const [teamName, setTeamName] = useState("");

  const active = list.find((w) => w.id === activeId) ?? list[0];

  const load = useCallback(async () => {
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
          setMembers(await fetchWorkspaceMembers(next));
        } else {
          setMembers([]);
        }
      }
    } catch {
      setList([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSelect(id: string) {
    setActiveId(id);
    setActiveWorkspaceId(id);
    setOpen(false);
    setInviteUrl(null);
    setShowTeamCreate(false);
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
    setShowTeamCreate(false);
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
      // ignore
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!activeId) return;
    await removeWorkspaceMember(activeId, memberId);
    setMembers(await fetchWorkspaceMembers(activeId));
  }

  if (!list.length) return null;

  const personalWorkspace = list.find((w) => w.is_personal);
  const teamWorkspaces = list.filter((w) => !w.is_personal);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-200 transition hover:bg-black/50"
      >
        <div className="flex items-center gap-2">
          {active?.is_personal ? (
            <User className="size-4 text-zinc-500" />
          ) : (
            <Users className="size-4 text-orange-400" />
          )}
          <span className="truncate">{active?.name || "选择空间"}</span>
        </div>
        <ChevronDown className={`size-4 text-zinc-500 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-white/10 bg-[#0b0b0b] p-2 shadow-xl">
          {personalWorkspace && (
            <button
              type="button"
              onClick={() => handleSelect(personalWorkspace.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                activeId === personalWorkspace.id
                  ? "bg-orange-500/20 text-orange-300"
                  : "text-zinc-300 hover:bg-white/5"
              }`}
            >
              <User className="size-4 text-zinc-500" />
              <span>个人空间</span>
            </button>
          )}

          {teamWorkspaces.length > 0 && (
            <div className="mt-1.5 border-t border-white/5 pt-1.5">
              <p className="mb-1 px-2 text-[10px] text-zinc-600">团队空间</p>
              {teamWorkspaces.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => handleSelect(w.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                    activeId === w.id
                      ? "bg-orange-500/20 text-orange-300"
                      : "text-zinc-300 hover:bg-white/5"
                  }`}
                >
                  <Users className="size-4 text-zinc-500" />
                  <span className="truncate">{w.name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-1.5 border-t border-white/5 pt-1.5">
            <button
              type="button"
              onClick={() => setShowTeamCreate(!showTeamCreate)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
            >
              <Plus className="size-4" />
              <span>创建团队</span>
            </button>
          </div>

          {showTeamCreate && (
            <div className="mt-2 flex gap-2 px-2">
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="团队名称"
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-xs text-zinc-300"
              />
              <button
                type="button"
                onClick={() => void handleCreateTeam()}
                className="shrink-0 rounded-lg bg-orange-500 px-2 py-1 text-xs font-medium text-white hover:bg-orange-600"
              >
                创建
              </button>
            </div>
          )}
        </div>
      )}

      {active && !active.is_personal && (
        <div className="mt-2 space-y-1.5">
          <button
            type="button"
            onClick={() => void handleInvite()}
            className="w-full rounded-lg border border-white/10 bg-orange-500/10 px-2 py-1.5 text-xs text-orange-300 transition hover:bg-orange-500/20"
          >
            邀请成员
          </button>
          {inviteUrl && (
            <p className="break-all rounded bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-400">
              链接已复制
            </p>
          )}
          {members.length > 0 && (
            <ul className="max-h-20 space-y-0.5 overflow-y-auto text-[10px] text-zinc-500">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-1">
                  <span className="truncate">{m.email}</span>
                  <span className="shrink-0 text-zinc-600">{m.role}</span>
                  {active.role === "owner" && m.role !== "owner" ? (
                    <button
                      type="button"
                      className="text-red-400/80 hover:text-red-300"
                      onClick={() => void handleRemoveMember(m.id)}
                    >
                      移除
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}