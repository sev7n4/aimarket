export type OrchestratorRole = "system" | "user" | "assistant";

export interface OrchestratorMessage {
  role: OrchestratorRole;
  content: string;
}

export interface OrchestratorToolArg {
  [key: string]: unknown;
}

export interface OrchestratorToolCall {
  id: string;
  name: string;
  arguments: OrchestratorToolArg;
}

export interface OrchestratorToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export type OrchestratorToolChoice = "none" | "auto" | "required";

export interface OrchestratorCompleteParams {
  messages: OrchestratorMessage[];
  jsonSchema?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  tools?: OrchestratorToolDefinition[];
  toolChoice?: OrchestratorToolChoice;
}

export interface OrchestratorCompleteResult {
  content: string;
  providerId: string;
  model: string;
  toolCalls?: OrchestratorToolCall[];
}

export interface OrchestratorProvider {
  readonly id: string;
  complete(params: OrchestratorCompleteParams): Promise<OrchestratorCompleteResult>;
}

export type OrchestratorVendor = "deepseek" | "qwen" | "glm" | "openai" | "claude" | "agnes";
