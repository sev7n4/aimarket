import { randomUUID } from "@/lib/uuid";

const DRAFT_KEY_PREFIX = "aimarket:studio-draft:";

export const AUTO_SESSION_TITLES = new Set(["未命名", "新建画布", "新建项目"]);

export function draftSessionStorageKey(workspaceId?: string | null): string {
  return `${DRAFT_KEY_PREFIX}${workspaceId ?? "personal"}`;
}

export function readDraftSessionId(workspaceId?: string | null): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(draftSessionStorageKey(workspaceId));
  } catch {
    return null;
  }
}

export function writeDraftSessionId(
  sessionId: string,
  workspaceId?: string | null,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(draftSessionStorageKey(workspaceId), sessionId);
  } catch {
    // ignore quota / private mode
  }
}

/** 分配新的本地草稿 sessionId（不入库，写入 localStorage） */
export function allocateDraftSessionId(workspaceId?: string | null): string {
  const id = randomUUID();
  writeDraftSessionId(id, workspaceId);
  return id;
}

/** 复用已有草稿，否则分配新草稿 */
export function getOrCreateDraftSessionId(workspaceId?: string | null): string {
  return readDraftSessionId(workspaceId) ?? allocateDraftSessionId(workspaceId);
}
