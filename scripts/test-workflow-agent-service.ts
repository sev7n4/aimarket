/**
 * workflow-agent 历史会话单测
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-workflow-agent-service.ts
 */
import { randomUUID } from "node:crypto";
import { db } from "../apps/api/src/db/index.js";
import {
  appendWorkflowAgentMessage,
  createWorkflowAgentConversation,
  listWorkflowAgentConversations,
  listWorkflowAgentMessages,
} from "../apps/api/src/lib/workflow-agent-service.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

function createUser(): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, credits, email_verified_at)
     VALUES (?, ?, 'hash', 10000, datetime('now'))`,
  ).run(id, `agent-${id.slice(0, 8)}@test.local`);
  return id;
}

const userId = createUser();
const sessionId = randomUUID();
db.prepare(
  `INSERT INTO image_sessions (id, user_id, title, mode, kind) VALUES (?, ?, 'agent-test', 'chat', 'canvas')`,
).run(sessionId, userId);

const conv = createWorkflowAgentConversation(userId, {
  sessionId,
  title: "测试对话",
});
ok("create conversation", conv.id.length > 0);

appendWorkflowAgentMessage(userId, conv.id, {
  role: "user",
  content: "帮我加文生图节点",
});
appendWorkflowAgentMessage(userId, conv.id, {
  role: "assistant",
  content: "已添加文生图节点",
});

const list = listWorkflowAgentConversations(userId, sessionId);
ok("list conversations", list.length === 1);

const messages = listWorkflowAgentMessages(userId, conv.id);
ok("list messages", messages.length === 2);
ok("assistant message", messages[1]?.role === "assistant");

const failed = results.filter((r) => !r.pass);
if (failed.length) process.exit(1);
console.log(`\n${results.length} passed`);
