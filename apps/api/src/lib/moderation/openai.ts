import type { ModerationProvider, ModerationResult } from "./types.js";
import { localModerationProvider } from "./local.js";

export const openaiModerationProvider: ModerationProvider = {
  name: "openai",
  async check(text: string): Promise<ModerationResult> {
    const trimmed = text.trim();
    if (!trimmed) return { allowed: true, provider: "openai" };

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return localModerationProvider.check(trimmed);
    }

    const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(
      /\/$/,
      "",
    );
    const model =
      process.env.OPENAI_MODERATION_MODEL ?? "omni-moderation-latest";

    try {
      const res = await fetch(`${base}/moderations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: trimmed, model }),
      });

      if (!res.ok) {
        console.warn("[moderation:openai] API error", res.status);
        return localModerationProvider.check(trimmed);
      }

      const json = (await res.json()) as {
        results?: { flagged?: boolean }[];
      };
      const flagged = json.results?.[0]?.flagged === true;
      return { allowed: !flagged, provider: "openai" };
    } catch (err) {
      console.warn("[moderation:openai] request failed", err);
      return localModerationProvider.check(trimmed);
    }
  },
};
