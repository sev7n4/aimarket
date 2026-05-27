const key = (sessionId: string) => `aimarket_pending_assets_${sessionId}`;

export function storePendingAssets(sessionId: string, assetIds: string[]) {
  if (typeof sessionStorage === "undefined" || !assetIds.length) return;
  sessionStorage.setItem(key(sessionId), JSON.stringify(assetIds));
}

export function consumePendingAssets(sessionId: string): string[] {
  if (typeof sessionStorage === "undefined") return [];
  const raw = sessionStorage.getItem(key(sessionId));
  if (!raw) return [];
  sessionStorage.removeItem(key(sessionId));
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}
