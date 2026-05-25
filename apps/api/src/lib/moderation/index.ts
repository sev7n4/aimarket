import { httpModerationProvider } from "./http.js";
import { localModerationProvider } from "./local.js";
import { openaiModerationProvider } from "./openai.js";
import type { ModerationProvider } from "./types.js";

export function resolveModerationProvider(): ModerationProvider {
  const mode = process.env.MODERATION_PROVIDER ?? "auto";

  if (mode === "local") return localModerationProvider;
  if (mode === "openai") return openaiModerationProvider;
  if (mode === "http") return httpModerationProvider;

  if (process.env.MODERATION_HTTP_URL) return httpModerationProvider;
  if (process.env.OPENAI_API_KEY) return openaiModerationProvider;
  return localModerationProvider;
}

export function getModerationStatus() {
  const active = resolveModerationProvider();
  return {
    provider: active.name,
    mode: process.env.MODERATION_PROVIDER ?? "auto",
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    httpConfigured: Boolean(process.env.MODERATION_HTTP_URL),
    fallback: "local",
  };
}

export async function checkPromptModeration(text: string) {
  const provider = resolveModerationProvider();
  const result = await provider.check(text);
  return { ...result, provider: provider.name };
}
