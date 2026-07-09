import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db/index.js";
import { AppError } from "./errors.js";
import { assertSessionWrite } from "./session-access.js";

export const createConversationBody = z.object({
  sessionId: z.string().uuid(),
  title: z.string().min(1).max(120).optional(),
});

export const appendMessageBody = z.object({
  role: z.enum(["user", "assistant", "tool", "system"]),
  content: z.string().max(32000).default(""),
  toolCalls: z.array(z.record(z.unknown())).optional(),
});

type ConversationRow = {
  id: string;
  session_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  tool_calls_json: string | null;
  created_at: string;
};

function serializeConversation(row: ConversationRow) {
  return {
    id: row.id,
    sessionId: row.session_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeMessage(row: MessageRow) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    toolCalls: row.tool_calls_json
      ? (JSON.parse(row.tool_calls_json) as unknown[])
      : undefined,
    createdAt: row.created_at,
  };
}

export function listWorkflowAgentConversations(userId: string, sessionId: string) {
  assertSessionWrite(userId, sessionId);
  const rows = db
    .prepare(
      `SELECT * FROM workflow_agent_conversations
       WHERE session_id = ? AND user_id = ?
       ORDER BY updated_at DESC`,
    )
    .all(sessionId, userId) as ConversationRow[];
  return rows.map(serializeConversation);
}

export function createWorkflowAgentConversation(
  userId: string,
  body: z.infer<typeof createConversationBody>,
) {
  assertSessionWrite(userId, body.sessionId);
  const id = randomUUID();
  const title = body.title?.trim() || "新对话";
  db.prepare(
    `INSERT INTO workflow_agent_conversations (id, session_id, user_id, title)
     VALUES (?, ?, ?, ?)`,
  ).run(id, body.sessionId, userId, title);
  const row = db
    .prepare(`SELECT * FROM workflow_agent_conversations WHERE id = ?`)
    .get(id) as ConversationRow;
  return serializeConversation(row);
}

function assertConversationAccess(userId: string, conversationId: string) {
  const row = db
    .prepare(`SELECT * FROM workflow_agent_conversations WHERE id = ?`)
    .get(conversationId) as ConversationRow | undefined;
  if (!row || row.user_id !== userId) {
    throw new AppError(404, "NOT_FOUND", "对话不存在");
  }
  return row;
}

export function listWorkflowAgentMessages(userId: string, conversationId: string) {
  assertConversationAccess(userId, conversationId);
  const rows = db
    .prepare(
      `SELECT * FROM workflow_agent_messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC`,
    )
    .all(conversationId) as MessageRow[];
  return rows.map(serializeMessage);
}

export function appendWorkflowAgentMessage(
  userId: string,
  conversationId: string,
  body: z.infer<typeof appendMessageBody>,
) {
  assertConversationAccess(userId, conversationId);
  const id = randomUUID();
  db.prepare(
    `INSERT INTO workflow_agent_messages (id, conversation_id, role, content, tool_calls_json)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    id,
    conversationId,
    body.role,
    body.content,
    body.toolCalls ? JSON.stringify(body.toolCalls) : null,
  );
  db.prepare(
    `UPDATE workflow_agent_conversations SET updated_at = datetime('now') WHERE id = ?`,
  ).run(conversationId);
  const row = db
    .prepare(`SELECT * FROM workflow_agent_messages WHERE id = ?`)
    .get(id) as MessageRow;
  return serializeMessage(row);
}

export function deleteWorkflowAgentConversation(userId: string, conversationId: string) {
  assertConversationAccess(userId, conversationId);
  db.prepare(`DELETE FROM workflow_agent_messages WHERE conversation_id = ?`).run(
    conversationId,
  );
  db.prepare(`DELETE FROM workflow_agent_conversations WHERE id = ?`).run(conversationId);
  return { deleted: true, id: conversationId };
}
