import type {
  OrchestratorCompleteParams,
  OrchestratorCompleteResult,
  OrchestratorProvider,
} from "./types.js";

export interface ClaudeProviderConfig {
  apiKey: string;
  model: string;
}

export function createClaudeProvider(
  config: ClaudeProviderConfig,
): OrchestratorProvider {
  return {
    id: "claude",
    async complete(
      params: OrchestratorCompleteParams,
    ): Promise<OrchestratorCompleteResult> {
      const system = params.messages.find((m) => m.role === "system")?.content;
      const messages = params.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        }));

      const body: Record<string, unknown> = {
        model: config.model,
        max_tokens: params.maxTokens ?? 2048,
        temperature: params.temperature ?? 0.2,
        messages,
      };
      if (system) body.system = system;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`[claude] ${res.status}: ${text.slice(0, 200)}`);
      }

      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const content = data.content?.find((c) => c.type === "text")?.text?.trim();
      if (!content) throw new Error("[claude] empty completion");

      return { content, providerId: "claude", model: config.model };
    },
  };
}
