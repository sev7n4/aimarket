"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { fetchWorkspaces, fetchWorkspaceMembers } from "@/lib/api-client";
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

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  activeWorkspaceId: string | null;
  members: Member[];
  loading: boolean;
  switchWorkspace: (id: string) => void;
  refreshWorkspaces: () => void;
  refreshMembers: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return ctx;
}

interface WorkspaceProviderProps {
  children: ReactNode;
  onWorkspaceChange?: (workspaceId: string) => void;
}

export function WorkspaceProvider({
  children,
  onWorkspaceChange,
}: WorkspaceProviderProps) {
  const onWorkspaceChangeRef = useRef(onWorkspaceChange);
  onWorkspaceChangeRef.current = onWorkspaceChange;

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWsId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    try {
      const ws = await fetchWorkspaces();
      setWorkspaces(ws);
      const stored = getActiveWorkspaceId();
      const next =
        stored && ws.some((w) => w.id === stored)
          ? stored
          : ws.find((w) => w.is_personal)?.id ?? ws[0]?.id;
      if (next) {
        setActiveWsId(next);
        setActiveWorkspaceId(next);
        onWorkspaceChangeRef.current?.(next);
        const activeWs = ws.find((w) => w.id === next);
        if (activeWs && !activeWs.is_personal) {
          setMembers(await fetchWorkspaceMembers(next));
        } else {
          setMembers([]);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const switchWorkspace = useCallback(async (id: string) => {
    setActiveWsId(id);
    setActiveWorkspaceId(id);
    onWorkspaceChangeRef.current?.(id);
    const ws = workspaces.find((w) => w.id === id);
    if (ws && !ws.is_personal) {
      setMembers(await fetchWorkspaceMembers(id));
    } else {
      setMembers([]);
    }
  }, [workspaces]);

  const refreshMembers = useCallback(async () => {
    if (!activeWorkspaceId || activeWorkspace?.is_personal) return;
    setMembers(await fetchWorkspaceMembers(activeWorkspaceId));
  }, [activeWorkspaceId, activeWorkspace]);

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        activeWorkspaceId,
        members,
        loading,
        switchWorkspace,
        refreshWorkspaces: loadWorkspaces,
        refreshMembers,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}