import type { CreationLane } from "@/lib/creation-dock-prefs";
import {
  resolveInspirationCreationLane,
  type StudioInspirationApply,
} from "@/lib/inspiration-studio";

const key = (sessionId: string) =>
  `aimarket_pending_inspiration_${sessionId}`;

export type PendingInspirationPayload = Omit<
  StudioInspirationApply,
  "applyKey" | "creationLane"
> & {
  /** 旧 sessionStorage 可能无此字段 */
  creationLane?: CreationLane;
};

export function normalizePendingInspiration(
  payload: PendingInspirationPayload,
): Omit<StudioInspirationApply, "applyKey"> {
  const creationLane =
    payload.creationLane ??
    resolveInspirationCreationLane({
      modelId: payload.modelId,
      mediaType: undefined,
      coverUrl: payload.referenceUrls[0] ?? "",
      referenceAssets: payload.referenceUrls.map((url) => ({ url })),
    });
  return { ...payload, creationLane };
}

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
