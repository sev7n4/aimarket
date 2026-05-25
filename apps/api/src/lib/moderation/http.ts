import type { ModerationProvider, ModerationResult } from "./types.js";
import { localModerationProvider } from "./local.js";

export const httpModerationProvider: ModerationProvider = {
  name: "http",
  async check(text: string): Promise<ModerationResult> {
    const trimmed = text.trim();
    if (!trimmed) return { allowed: true, provider: "http" };

    const url = process.env.MODERATION_HTTP_URL?.trim();
    if (!url) {
      return localModerationProvider.check(trimmed);
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const key = process.env.MODERATION_HTTP_KEY;
    if (key) headers.Authorization = `Bearer ${key}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ text: trimmed }),
      });

      if (!res.ok) {
        console.warn("[moderation:http] API error", res.status);
        return localModerationProvider.check(trimmed);
      }

      const json = (await res.json()) as {
        allowed?: boolean;
        flagged?: boolean;
      };
      if (typeof json.allowed === "boolean") {
        return { allowed: json.allowed, provider: "http" };
      }
      if (typeof json.flagged === "boolean") {
        return { allowed: !json.flagged, provider: "http" };
      }
      return localModerationProvider.check(trimmed);
    } catch (err) {
      console.warn("[moderation:http] request failed", err);
      return localModerationProvider.check(trimmed);
    }
  },
};
