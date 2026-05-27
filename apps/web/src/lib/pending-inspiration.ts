import type { StudioInspirationApply } from "@/lib/inspiration-studio";

const key = (sessionId: string) =>
  `aimarket_pending_inspiration_${sessionId}`;

export type PendingInspirationPayload = Omit<
  StudioInspirationApply,
  "applyKey"
>;

export function storePendingInspiration(
  sessionId: string,
  payload: PendingInspirationPayload,
) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(key(sessionId), JSON.stringify(payload));
}

export function consumePendingInspiration(
  sessionId: string,
): PendingInspirationPayload | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(key(sessionId));
  if (!raw) return null;
  sessionStorage.removeItem(key(sessionId));
  try {
    const parsed = JSON.parse(raw) as PendingInspirationPayload;
    if (!parsed || typeof parsed !== "object" || !parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
}
