import { resolveApiBase } from "@/lib/api-base";
import { getToken } from "@/lib/api-client";

export type OrchestratorMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OrchestratorToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type OrchestratorToolDefinition = {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
};

export type OrchestratorToolChoice = "none" | "auto" | "required";

const API_BASE = resolveApiBase();

export type ToolResponseStreamResult = {
  content: string;
  toolCalls: OrchestratorToolCall[];
  providerId: string;
  model?: string;
};

export type ToolResponseStreamCallbacks = {
  onDelta: (delta: string) => void;
  onToolCalls?: (toolCalls: OrchestratorToolCall[]) => void;
  onDone: (result: ToolResponseStreamResult) => void;
  onError: (message: string) => void;
};

function parseSseBlock(block: string): { event: string; data: string } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

export async function streamToolResponse(
  input: {
    messages: OrchestratorMessage[];
    tools: OrchestratorToolDefinition[];
    toolChoice: OrchestratorToolChoice;
    maxTokens?: number;
  },
  callbacks: ToolResponseStreamCallbacks,
  signal?: AbortSignal,
): Promise<ToolResponseStreamResult | null> {
  const token = getToken();
  if (!token) {
    callbacks.onError("未登录");
    return null;
  }

  const res = await fetch(`${API_BASE}/api/v1/agent/tool-response/stream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: input.messages,
      tools: input.tools,
      toolChoice: input.toolChoice,
      maxTokens: input.maxTokens ?? 4096,
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    callbacks.onError(`流式 Agent 连接失败 (${res.status})`);
    return null;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: ToolResponseStreamResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const parsed = parseSseBlock(part);
      if (!parsed) continue;

      try {
        const payload = JSON.parse(parsed.data) as Record<string, unknown>;
        if (parsed.event === "delta" && typeof payload.delta === "string") {
          callbacks.onDelta(payload.delta);
        } else if (parsed.event === "tool_calls" && Array.isArray(payload.toolCalls)) {
          callbacks.onToolCalls?.(payload.toolCalls as OrchestratorToolCall[]);
        } else if (parsed.event === "done") {
          finalResult = {
            content: String(payload.content ?? ""),
            toolCalls: (payload.toolCalls as OrchestratorToolCall[]) ?? [],
            providerId: String(payload.providerId ?? ""),
            model: payload.model ? String(payload.model) : undefined,
          };
          callbacks.onDone(finalResult);
        } else if (parsed.event === "error") {
          callbacks.onError(String(payload.message ?? "Agent 流式响应失败"));
          return null;
        }
      } catch {
        /* ignore malformed chunk */
      }
    }
  }

  return finalResult;
}
