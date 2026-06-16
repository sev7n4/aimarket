import { completeWithFallback, isAgentLlmEnabled } from "@aimarket/agent-core";
import type { DramaPlanAgentId } from "./types.js";

function envFlag(name: string, defaultValue = false): boolean {
  const v = process.env[name];
  if (v === undefined) return defaultValue;
  return v === "1" || v.toLowerCase() === "true";
}

const PRIMARY_MODEL_ENV: Record<string, string> = {
  deepseek: "AGENT_LLM_DEEPSEEK_MODEL",
  qwen: "AGENT_LLM_QWEN_MODEL",
  glm: "AGENT_LLM_GLM_MODEL",
  openai: "AGENT_LLM_OPENAI_MODEL",
  claude: "AGENT_LLM_CLAUDE_MODEL",
};

export function isDramaMultiAgentPlanEnabled(): boolean {
  if (!isAgentLlmEnabled()) return false;
  return envFlag("AGENT_DRAMA_PLAN_ENABLED", true);
}

export function isDramaPlanThinkEnabled(): boolean {
  return envFlag("DRAMA_PLAN_THINK_ENABLED", false);
}

const REASONING_MAX = 2000;

async function completeWithDramaPlanModels(
  params: Parameters<typeof completeWithFallback>[0],
): Promise<Awaited<ReturnType<typeof completeWithFallback>>> {
  const primary = (process.env.AGENT_LLM_PRIMARY ?? "deepseek").toLowerCase();
  const modelKey = PRIMARY_MODEL_ENV[primary];
  const planModel = process.env.AGENT_DRAMA_PLAN_MODEL?.trim();
  const fallbackModel = process.env.AGENT_DRAMA_PLAN_FALLBACK_MODEL?.trim();

  const runWithModel = async (model?: string) => {
    if (!model || !modelKey) {
      return completeWithFallback(params);
    }
    const prev = process.env[modelKey];
    process.env[modelKey] = model;
    try {
      return await completeWithFallback(params);
    } finally {
      if (prev === undefined) delete process.env[modelKey];
      else process.env[modelKey] = prev;
    }
  };

  try {
    return await runWithModel(planModel);
  } catch (err) {
    if (fallbackModel && fallbackModel !== planModel) {
      return runWithModel(fallbackModel);
    }
    throw err;
  }
}

export async function runAgentStep<T>(
  agent: DramaPlanAgentId,
  systemPrompt: string,
  userPrompt: string,
  jsonSchema: Record<string, unknown>,
): Promise<{ output: T; reasoning?: string }> {
  let reasoning: string | undefined;

  if (isDramaPlanThinkEnabled()) {
    const think = await completeWithDramaPlanModels({
      messages: [
        { role: "system", content: `${systemPrompt}\n先简要推理创作思路（纯文本，不超过 800 字），不要输出 JSON。` },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
      maxTokens: 1024,
    });
    reasoning = think.content.slice(0, REASONING_MAX);
  }

  const commitMessages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];
  if (reasoning) {
    commitMessages.push({
      role: "user" as const,
      content: `创作推理摘要：\n${reasoning}\n\n请据此输出严格 JSON。`,
    });
  }

  const result = await completeWithDramaPlanModels({
    messages: commitMessages,
    jsonSchema,
    temperature: 0.35,
    maxTokens: 8192,
  });

  const output = JSON.parse(result.content) as T;
  return { output, reasoning };
}
