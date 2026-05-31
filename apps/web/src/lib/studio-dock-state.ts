export type StudioDockMode = "expanded" | "focus";

const STORAGE_KEY = "aimarket_studio_dock_mode_v1";

export function readStudioDockMode(): StudioDockMode | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === "focus") return "focus";
  // 历史 compact / expanded 均视为默认展开
  if (raw === "compact" || raw === "expanded") return "expanded";
  return null;
}

export function persistStudioDockMode(mode: StudioDockMode) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, mode);
}

export function defaultStudioDockMode(_isMobile?: boolean): StudioDockMode {
  return "expanded";
}
