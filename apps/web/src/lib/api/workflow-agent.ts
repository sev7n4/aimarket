import { request } from "./core";

export type WorkflowAgentConversation = {
  id: string;
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowAgentMessage = {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  toolCalls?: unknown[];
  createdAt: string;
};

export async function listWorkflowAgentConversations(sessionId: string) {
  const params = new URLSearchParams({ sessionId });
  const res = await request<{ data: WorkflowAgentConversation[] }>(
    `/api/v1/workflow-agent/conversations?${params.toString()}`,
  );
  return res.data;
}

export async function createWorkflowAgentConversation(body: {
  sessionId: string;
  title?: string;
}) {
  const res = await request<{ data: WorkflowAgentConversation }>(
    "/api/v1/workflow-agent/conversations",
    { method: "POST", body: JSON.stringify(body) },
  );
  return res.data;
}

export async function listWorkflowAgentMessages(conversationId: string) {
  const res = await request<{ data: WorkflowAgentMessage[] }>(
    `/api/v1/workflow-agent/conversations/${conversationId}/messages`,
  );
  return res.data;
}

export async function appendWorkflowAgentMessage(
  conversationId: string,
  body: { role: string; content: string; toolCalls?: unknown[] },
) {
  const res = await request<{ data: WorkflowAgentMessage }>(
    `/api/v1/workflow-agent/conversations/${conversationId}/messages`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return res.data;
}

export async function deleteWorkflowAgentConversation(conversationId: string) {
  await request(`/api/v1/workflow-agent/conversations/${conversationId}`, {
    method: "DELETE",
  });
}
