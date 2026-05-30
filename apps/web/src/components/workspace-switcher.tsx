"use client";

import { useState } from "react";
import { User, Users, ChevronDown, Plus, Settings } from "lucide-react";
import { createWorkspace } from "@/lib/api-client";
import { useWorkspace } from "@/lib/workspace-context";
import { TeamSettingsDialog } from "@/components/team-settings-dialog";

interface WorkspaceSwitcherProps {
  onWorkspaceChange?: (workspaceId: string) => void;
}

export function WorkspaceSwitcher({ onWorkspaceChange }: WorkspaceSwitcherProps) {
  const {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    loading,
    switchWorkspace,
    refreshWorkspaces,
  } = useWorkspace();

  const [open, setOpen] = useState(false);
  const [showTeamCreate, setShowTeamCreate] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamSettingsOpen, setTeamSettingsOpen] = useState(false);

  if (!workspaces.length) return null;

  const personalWorkspace = workspaces.find((w) => w.is_personal);
  const teamWorkspaces = workspaces.filter((w) => !w.is_personal);

  async function handleCreateTeam() {
    const name = teamName.trim() || "团队工作区";
    const ws = await createWorkspace(name);
    setTeamName("");
    setShowTeamCreate(false);
    await refreshWorkspaces();
    await switchWorkspace(ws.id);
    if (onWorkspaceChange) onWorkspaceChange(ws.id);
  }

  function handleSelect(id: string) {
    switchWorkspace(id);
    if (onWorkspaceChange) onWorkspaceChange(id);
    setOpen(false);
    setShowTeamCreate(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-200 transition hover:bg-black/50"
      >
        <div className="flex items-center gap-2">
          {activeWorkspace?.is_personal ? (
            <User className="size-4 text-zinc-500" />
          ) : (
            <Users className="size-4 text-orange-400" />
          )}
          <span className="truncate">{activeWorkspace?.name || "选择空间"}</span>
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
                activeWorkspaceId === personalWorkspace.id
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
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                    activeWorkspaceId === w.id
                      ? "bg-orange-500/20 text-orange-300"
                      : "text-zinc-300 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-zinc-500" />
                    <span className="truncate">{w.name}</span>
                  </div>
                  {activeWorkspaceId === w.id && w.role === "owner" ? (
                    <Settings
                      className="size-3.5 text-zinc-400 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpen(false);
                        setTeamSettingsOpen(true);
                      }}
                    />
                  ) : null}
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
                disabled={loading}
                className="shrink-0 rounded-lg bg-orange-500 px-2 py-1 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
              >
                创建
              </button>
            </div>
          )}
        </div>
      )}

      <TeamSettingsDialog
        open={teamSettingsOpen}
        onClose={() => setTeamSettingsOpen(false)}
      />
    </div>
  );
}