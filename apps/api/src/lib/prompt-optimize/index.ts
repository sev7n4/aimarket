import { optimizePromptWithOpenAI } from "./openai.js";
import { optimizePromptWithTemplate } from "./template.js";
import type {
  OptimizeMode,
  PromptOptimizeResult,
  PromptOptimizeSource,
} from "./types.js";

export { optimizeModeSchema } from "./types.js";
export type { OptimizeMode, PromptOptimizeResult, PromptOptimizeSource };

function resolveProviderMode(): "mock" | "openai" | "auto" {
  const mode = (process.env.PROMPT_OPTIMIZE_PROVIDER ?? "auto").toLowerCase();
  if (mode === "mock" || mode === "openai") return mode;
  return "auto";
}

export function getPromptOptimizeStatus() {
  const mode = resolveProviderMode();
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  const activeProvider: PromptOptimizeSource =
    mode === "openai" || (mode === "auto" && openaiConfigured)
      ? "openai"
      : "template-mock";

  let hint: string;
  if (mode === "openai" && !openaiConfigured) {
    hint = "已强制 openai 但未配置 OPENAI_API_KEY，请求将回落模板润色";
  } else if (activeProvider === "template-mock" && openaiConfigured) {
    hint = "未启用 LLM 或 openai 失败时走模板润色；可设 PROMPT_OPTIMIZE_PROVIDER=openai";
  } else if (activeProvider === "openai") {
    hint = "提示词润色走 OpenAI Chat";
  } else {
    hint = "提示词润色走本地模板（mock）";
  }

  return {
    mode,
    activeProvider,
    openaiConfigured,
    chatModel: process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini",
    usingMock: activeProvider === "template-mock",
    hint,
  };
}

/** @deprecated 同步模板润色，仅供单测或内部回落 */
export function optimizePrompt(mode: OptimizeMode, raw: string): string {
  return optimizePromptWithTemplate(mode, raw);
}

export async function optimizePromptAsync(
  mode: OptimizeMode,
  raw: string,
): Promise<PromptOptimizeResult> {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { prompt: raw, source: "template-mock" };
  }

  const providerMode = resolveProviderMode();
  const tryOpenAi =
    providerMode === "openai" ||
    (providerMode === "auto" && Boolean(process.env.OPENAI_API_KEY?.trim()));

  if (tryOpenAi) {
    try {
      const prompt = await optimizePromptWithOpenAI(mode, trimmed);
      return { prompt, source: "openai" };
    } catch (err) {
      console.warn("[prompt-optimize] OpenAI 失败，回落模板", err);
      if (providerMode === "openai") {
        throw err;
      }
    }
  }

  return {
    prompt: optimizePromptWithTemplate(mode, trimmed),
    source: "template-mock",
  };
}
