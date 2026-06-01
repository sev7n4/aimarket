export type OrchestratorRole = "system" | "user" | "assistant";

export interface OrchestratorMessage {
  role: OrchestratorRole;
  content: string;
}

export interface OrchestratorCompleteParams {
  messages: OrchestratorMessage[];
  jsonSchema?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
}

export interface OrchestratorCompleteResult {
  content: string;
  providerId: string;
  model: string;
}

export interface OrchestratorProvider {
  readonly id: string;
  complete(params: OrchestratorCompleteParams): Promise<OrchestratorCompleteResult>;
}

export type OrchestratorVendor = "deepseek" | "qwen" | "glm" | "openai" | "claude";
