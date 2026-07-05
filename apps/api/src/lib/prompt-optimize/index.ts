import { resolveDirection } from "./context.js";
import { optimizePromptWithDashScope } from "./dashscope.js";
import { optimizePromptWithOpenAI } from "./openai.js";
import { optimizePromptWithTemplate } from "./template.js";
import type {
  OptimizeMode,
  PromptOptimizeContext,
  PromptOptimizeResult,
  PromptOptimizeSource,
} from "./types.js";

export { optimizeModeSchema, promptOptimizeContextSchema } from "./types.js";
export type {
  OptimizeMode,
  PromptOptimizeContext,
  PromptOptimizeResult,
  PromptOptimizeSource,
};

type ProviderMode = "mock" | "openai" | "dashscope" | "auto";

function resolveProviderMode(): ProviderMode {
  const mode = (process.env.PROMPT_OPTIMIZE_PROVIDER ?? "auto").toLowerCase();
  if (
    mode === "mock" ||
    mode === "openai" ||
    mode === "dashscope"
  ) {
    return mode;
  }
  return "auto";
}

function dashscopeConfigured(): boolean {
  return Boolean(process.env.DASHSCOPE_API_KEY?.trim());
}

function openaiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function resolveActiveProvider(): PromptOptimizeSource {
  const mode = resolveProviderMode();
  if (mode === "openai") return openaiConfigured() ? "openai" : "template-mock";
  if (mode === "dashscope") {
    return dashscopeConfigured() ? "dashscope" : "template-mock";
  }
  if (mode === "mock") return "template-mock";
  if (dashscopeConfigured()) return "dashscope";
  if (openaiConfigured()) return "openai";
  return "template-mock";
}

export function getPromptOptimizeStatus() {
  const mode = resolveProviderMode();
  const activeProvider = resolveActiveProvider();
  const dashscope = dashscopeConfigured();
  const openai = openaiConfigured();

  let hint: string;
  if (mode === "openai" && !openai) {
    hint = "已强制 openai 但未配置 OPENAI_API_KEY，请求将回落模板润色";
  } else if (mode === "dashscope" && !dashscope) {
    hint = "已强制 dashscope 但未配置 DASHSCOPE_API_KEY，请求将回落模板润色";
  } else if (activeProvider === "dashscope") {
    hint = `提示词润色走阿里百炼 Chat（${process.env.PROMPT_OPTIMIZE_DASHSCOPE_MODEL ?? "qwen-plus"}）`;
  } else if (activeProvider === "openai") {
    hint = `提示词润色走 OpenAI Chat（${process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini"}）`;
  } else if ((dashscope || openai) && activeProvider === "template-mock") {
    hint = "LLM 失败或未启用时走模板润色";
  } else {
    hint = "提示词润色走本地模板（mock）";
  }

  return {
    mode,
    activeProvider,
    openaiConfigured: openai,
    dashscopeConfigured: dashscope,
    chatModel: process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini",
    dashscopeModel:
      process.env.PROMPT_OPTIMIZE_DASHSCOPE_MODEL ?? "qwen-plus",
    usingMock: activeProvider === "template-mock",
    hint,
  };
}

/** @deprecated 同步模板润色，仅供单测或内部回落 */
export function optimizePrompt(mode: OptimizeMode, raw: string): string {
  return optimizePromptWithTemplate(mode, raw);
}

async function tryProvider(
  source: PromptOptimizeSource,
  mode: OptimizeMode,
  raw: string,
  context?: PromptOptimizeContext,
): Promise<string> {
  switch (source) {
    case "dashscope":
      return optimizePromptWithDashScope(mode, raw, context);
    case "openai":
      return optimizePromptWithOpenAI(mode, raw, context);
    default:
      return optimizePromptWithTemplate(mode, raw);
  }
}

export async function optimizePromptAsync(
  mode: OptimizeMode,
  raw: string,
  context?: PromptOptimizeContext,
): Promise<PromptOptimizeResult> {
  const { direction, label: directionLabel } = resolveDirection(mode, context);

  const trimmed = raw.trim();
  if (!trimmed) {
    return { prompt: raw, source: "template-mock", direction, directionLabel };
  }

  const providerMode = resolveProviderMode();
  const chain: PromptOptimizeSource[] =
    providerMode === "mock"
      ? []
      : providerMode === "dashscope"
        ? dashscopeConfigured()
          ? ["dashscope"]
          : []
        : providerMode === "openai"
          ? openaiConfigured()
            ? ["openai"]
            : []
          : [
              ...(dashscopeConfigured() ? (["dashscope"] as const) : []),
              ...(openaiConfigured() ? (["openai"] as const) : []),
            ];

  for (const source of chain) {
    try {
      const prompt = await tryProvider(source, mode, trimmed, context);
      return { prompt, source, direction, directionLabel };
    } catch (err) {
      console.warn(`[prompt-optimize] ${source} 失败`, err);
      if (providerMode === source) {
        throw err;
      }
    }
  }

  return {
    prompt: optimizePromptWithTemplate(mode, trimmed),
    source: "template-mock",
    direction,
    directionLabel,
  };
}
