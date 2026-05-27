export interface PendingAsset {
  id: string;
  url: string;
}

const key = (sessionId: string) => `aimarket_pending_assets_${sessionId}`;

export function storePendingAssets(
  sessionId: string,
  assets: PendingAsset[],
) {
  if (typeof sessionStorage === "undefined" || !assets.length) return;
  sessionStorage.setItem(key(sessionId), JSON.stringify(assets));
}

export function consumePendingAssets(sessionId: string): PendingAsset[] {
  if (typeof sessionStorage === "undefined") return [];
  const raw = sessionStorage.getItem(key(sessionId));
  if (!raw) return [];
  sessionStorage.removeItem(key(sessionId));
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (typeof item === "string") return null;
        if (
          item &&
          typeof item === "object" &&
          "id" in item &&
          "url" in item &&
          typeof (item as PendingAsset).id === "string" &&
          typeof (item as PendingAsset).url === "string"
        ) {
          return item as PendingAsset;
        }
        return null;
      })
      .filter((x): x is PendingAsset => x !== null);
  } catch {
    return [];
  }
}
