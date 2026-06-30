/**
 * Shared types for Canvas Agent
 * Inline types mirroring agent-core to avoid workspace dependency issues
 */

export type OrchestratorRole = "system" | "user" | "assistant" | "tool";

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
