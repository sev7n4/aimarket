import { Hono } from "hono";
import type { AuthVariables } from "../middleware/auth.js";
import {
  appendWorkflowAgentMessage,
  appendMessageBody,
  createConversationBody,
  createWorkflowAgentConversation,
  deleteWorkflowAgentConversation,
  listWorkflowAgentConversations,
  listWorkflowAgentMessages,
} from "../lib/workflow-agent-service.js";

const workflowAgent = new Hono<{ Variables: AuthVariables }>();

workflowAgent.get("/conversations", (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.query("sessionId");
  if (!sessionId) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "sessionId required" } }, 400);
  }
  const data = listWorkflowAgentConversations(userId, sessionId);
  return c.json({ data });
});

workflowAgent.post("/conversations", async (c) => {
  const userId = c.get("userId");
  const body = createConversationBody.parse(await c.req.json());
  const data = createWorkflowAgentConversation(userId, body);
  return c.json({ data }, 201);
});

workflowAgent.delete("/conversations/:id", (c) => {
  const userId = c.get("userId");
  const data = deleteWorkflowAgentConversation(userId, c.req.param("id"));
  return c.json({ data });
});

workflowAgent.get("/conversations/:id/messages", (c) => {
  const userId = c.get("userId");
  const data = listWorkflowAgentMessages(userId, c.req.param("id"));
  return c.json({ data });
});

workflowAgent.post("/conversations/:id/messages", async (c) => {
  const userId = c.get("userId");
  const body = appendMessageBody.parse(await c.req.json());
  const data = appendWorkflowAgentMessage(userId, c.req.param("id"), body);
  return c.json({ data }, 201);
});

export { workflowAgent };
