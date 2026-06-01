import type {
  OrchestratorCompleteParams,
  OrchestratorCompleteResult,
  OrchestratorProvider,
} from "./types.js";

export interface OpenAiCompatibleConfig {
  id: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function createOpenAiCompatibleProvider(
  config: OpenAiCompatibleConfig,
): OrchestratorProvider {
  return {
    id: config.id,
    async complete(
      params: OrchestratorCompleteParams,
    ): Promise<OrchestratorCompleteResult> {
      const body: Record<string, unknown> = {
        model: config.model,
        messages: params.messages,
        temperature: params.temperature ?? 0.2,
        max_tokens: params.maxTokens ?? 2048,
      };

      if (params.jsonSchema) {
        body.response_format = {
          type: "json_schema",
          json_schema: {
            name: "agent_plan",
            strict: true,
            schema: params.jsonSchema,
          },
        };
      }

      const res = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `[${config.id}] LLM ${res.status}: ${text.slice(0, 200) || res.statusText}`,
        );
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new Error(`[${config.id}] empty completion`);
      }

      return {
        content,
        providerId: config.id,
        model: config.model,
      };
    },
  };
}
