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

      // Tool calling support
      if (params.tools?.length) {
        body.tools = params.tools.map((tool) => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        }));
        if (params.toolChoice) {
          body.tool_choice =
            params.toolChoice === "required"
              ? { type: "function" }
              : params.toolChoice === "none"
              ? { type: "none" }
              : "auto";
        }
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
        choices?: Array<{
          message?: {
            content?: string;
            tool_calls?: Array<{
              id: string;
              function?: { name?: string; arguments?: string };
            }>;
          };
        }>;
      };

      const message = data.choices?.[0]?.message;
      const content = message?.content?.trim() ?? "";

      const toolCalls =
        message?.tool_calls?.map((tc) => ({
          id: tc.id,
          name: tc.function?.name ?? "",
          arguments: (() => {
            try {
              return JSON.parse(tc.function?.arguments ?? "{}");
            } catch {
              return {};
            }
          })(),
        })) ?? [];

      if (!content && toolCalls.length === 0) {
        throw new Error(`[${config.id}] empty completion`);
      }

      return {
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        providerId: config.id,
        model: config.model,
      };
    },
  };
}
