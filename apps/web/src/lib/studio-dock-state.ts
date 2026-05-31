export type StudioDockMode = "compact" | "expanded" | "focus";

const STORAGE_KEY = "aimarket_studio_dock_mode_v1";

export function readStudioDockMode(): StudioDockMode | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === "compact" || raw === "expanded" || raw === "focus") return raw;
  return null;
}

export function persistStudioDockMode(mode: StudioDockMode) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, mode);
}

export function defaultStudioDockMode(isMobile: boolean): StudioDockMode {
  return isMobile ? "compact" : "compact";
}
