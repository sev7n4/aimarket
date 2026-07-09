/**
 * story-canvas 生成与 nodeKey 状态查询单测
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-story-canvas-generate.ts
 */
import { randomUUID } from "node:crypto";
import { db } from "../apps/api/src/db/index.js";
import {
  batchQueryWorkflowStatus,
  findLatestJobByNodeKey,
  parseWorkflowJobContext,
} from "../apps/api/src/lib/story-canvas-service.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

function createVerifiedUser(): string {
  const id = randomUUID();
  const email = `story-canvas-${id.slice(0, 8)}@test.local`;
  db.prepare(
    `INSERT INTO users (id, email, password_hash, credits, email_verified_at)
     VALUES (?, ?, 'hash', 10000, datetime('now'))`,
  ).run(id, email);
  return id;
}

function createSession(userId: string): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO image_sessions (id, user_id, title, mode, status)
     VALUES (?, ?, 'story-canvas-test', 'chat', 'idle')`,
  ).run(id, userId);
  return id;
}

function insertWorkflowJob(input: {
  sessionId: string;
  userId: string;
  nodeKey: string;
  status?: string;
  outputUrl?: string;
}): string {
  const jobId = randomUUID();
  const toolContext = JSON.stringify({
    workflowNodeKey: input.nodeKey,
    workflowToolType: "TEXT_TO_IMAGE",
  });
  db.prepare(
    `INSERT INTO generation_jobs
     (id, session_id, user_id, model_id, prompt, mode, count, resolution, aspect_ratio, status, points_cost, tool_context, source_lane)
     VALUES (?, ?, ?, 'seedream-4-5-251128', 'test prompt', 'image', 1, '1k', '1:1', ?, 10, ?, 'image')`,
  ).run(jobId, input.sessionId, input.userId, input.status ?? "running", toolContext);

  if (input.outputUrl) {
    db.prepare(
      `INSERT INTO job_outputs (id, job_id, url, sort_order) VALUES (?, ?, ?, 0)`,
    ).run(randomUUID(), jobId, input.outputUrl);
  }
  return jobId;
}

// --- parseWorkflowJobContext ---
ok(
  "parseWorkflowJobContext valid",
  parseWorkflowJobContext(
    JSON.stringify({ workflowNodeKey: "sess:node-1", workflowToolType: "TEXT_TO_IMAGE" }),
  )?.workflowNodeKey === "sess:node-1",
);
ok("parseWorkflowJobContext null", parseWorkflowJobContext(null) === null);
ok("parseWorkflowJobContext invalid json", parseWorkflowJobContext("{bad") === null);

const userId = createVerifiedUser();
const sessionId = createSession(userId);
const nodeKey = `${sessionId}:wf-node-1`;
const otherNodeKey = `${sessionId}:wf-node-2`;

// idle when no job
const idleStatus = batchQueryWorkflowStatus(userId, sessionId, [nodeKey]);
ok("batch idle when no job", idleStatus[nodeKey]?.status === "idle");

const jobId = insertWorkflowJob({
  sessionId,
  userId,
  nodeKey,
  status: "running",
});

const found = findLatestJobByNodeKey(sessionId, nodeKey);
ok("findLatestJobByNodeKey matches", found?.id === jobId);
ok("findLatestJobByNodeKey status", found?.status === "running");

const pendingStatus = batchQueryWorkflowStatus(userId, sessionId, [nodeKey, otherNodeKey]);
ok("batch running status", pendingStatus[nodeKey]?.status === "running");
ok("batch other node idle", pendingStatus[otherNodeKey]?.status === "idle");
ok("batch includes jobId", pendingStatus[nodeKey]?.jobId === jobId);

insertWorkflowJob({
  sessionId,
  userId,
  nodeKey,
  status: "succeeded",
  outputUrl: "/uploads/test/story-canvas-out.png",
});

const latest = findLatestJobByNodeKey(sessionId, nodeKey);
const successStatus = batchQueryWorkflowStatus(userId, sessionId, [nodeKey]);
ok("latest job is newest", latest?.status === "succeeded");
ok(
  "batch returns outputUrl",
  Boolean(successStatus[nodeKey]?.outputUrl?.includes("story-canvas-out.png")),
);

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error("\nFailed:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
console.log(`\n${results.length} passed`);
