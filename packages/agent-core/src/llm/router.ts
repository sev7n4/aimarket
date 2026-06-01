import { createClaudeProvider } from "./claude.js";
import { createOpenAiCompatibleProvider } from "./openai-compatible.js";
import type {
  OrchestratorCompleteParams,
  OrchestratorCompleteResult,
  OrchestratorProvider,
  OrchestratorVendor,
} from "./types.js";

function envFlag(name: string, defaultValue = false): boolean {
  const v = process.env[name];
  if (v === undefined) return defaultValue;
  return v === "1" || v.toLowerCase() === "true";
}

function parseVendorList(raw: string | undefined): OrchestratorVendor[] {
  if (!raw?.trim()) return ["deepseek", "qwen", "glm"];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean) as OrchestratorVendor[];
}

function buildProvider(vendor: OrchestratorVendor): OrchestratorProvider | null {
  switch (vendor) {
    case "deepseek": {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) return null;
      return createOpenAiCompatibleProvider({
        id: "deepseek",
        apiKey,
        baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
        model: process.env.AGENT_LLM_DEEPSEEK_MODEL ?? "deepseek-chat",
      });
    }
    case "qwen": {
      const apiKey = process.env.DASHSCOPE_API_KEY;
      if (!apiKey) return null;
      return createOpenAiCompatibleProvider({
        id: "qwen",
        apiKey,
        baseUrl:
          process.env.DASHSCOPE_LLM_BASE_URL ??
          "https://dashscope.aliyuncs.com/compatible-mode/v1",
        model: process.env.AGENT_LLM_QWEN_MODEL ?? "qwen-max",
      });
    }
    case "glm": {
      const apiKey = process.env.ZHIPU_API_KEY;
      if (!apiKey) return null;
      return createOpenAiCompatibleProvider({
        id: "glm",
        apiKey,
        baseUrl:
          process.env.ZHIPU_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
        model: process.env.AGENT_LLM_GLM_MODEL ?? "glm-4-plus",
      });
    }
    case "openai": {
      if (!envFlag("AGENT_LLM_ALLOW_OVERSEAS", false)) return null;
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return null;
      return createOpenAiCompatibleProvider({
        id: "openai",
        apiKey,
        baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
        model: process.env.AGENT_LLM_OPENAI_MODEL ?? "gpt-4o-mini",
      });
    }
    case "claude": {
      if (!envFlag("AGENT_LLM_ALLOW_OVERSEAS", false)) return null;
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return null;
      return createClaudeProvider({
        apiKey,
        model:
          process.env.AGENT_LLM_CLAUDE_MODEL ?? "claude-sonnet-4-20250514",
      });
    }
    default:
      return null;
  }
}

export function listOrchestratorProviders(): OrchestratorProvider[] {
  const primary = (process.env.AGENT_LLM_PRIMARY ?? "deepseek").toLowerCase() as OrchestratorVendor;
  const fallbacks = parseVendorList(process.env.AGENT_LLM_FALLBACKS);
  const order = [primary, ...fallbacks.filter((v) => v !== primary)];
  const seen = new Set<string>();
  const providers: OrchestratorProvider[] = [];
  for (const vendor of order) {
    const p = buildProvider(vendor);
    if (p && !seen.has(p.id)) {
      seen.add(p.id);
      providers.push(p);
    }
  }
  return providers;
}

export function isAgentLlmEnabled(): boolean {
  if (!envFlag("AGENT_LLM_ENABLED", true)) return false;
  return listOrchestratorProviders().length > 0;
}

export async function completeWithFallback(
  params: OrchestratorCompleteParams,
): Promise<OrchestratorCompleteResult> {
  const providers = listOrchestratorProviders();
  if (!providers.length) {
    throw new Error("NO_ORCHESTRATOR_PROVIDER");
  }

  let lastError: unknown;
  for (const provider of providers) {
    try {
      return await provider.complete(params);
    } catch (err) {
      lastError = err;
      console.warn(`[agent-llm] ${provider.id} failed:`, err);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("ALL_PROVIDERS_FAILED");
}
