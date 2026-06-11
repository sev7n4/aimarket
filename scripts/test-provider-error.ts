/**
 * provider-error + job provider_task_id 单测
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-provider-error.ts
 */
import { randomUUID } from "node:crypto";
import { db } from "../apps/api/src/db/index.js";
import { formatProviderError } from "../apps/api/src/lib/provider-error.js";
import { setJobProviderTaskId } from "../apps/api/src/lib/job-provider-task.js";
import { getJob } from "../apps/api/src/lib/jobs.js";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

ok(
  "object error serializes to JSON",
  formatProviderError({ code: "INVALID_IMAGE", message: "bad url" }) ===
    '{"code":"INVALID_IMAGE","message":"bad url"}',
);

ok(
  "string error unchanged",
  formatProviderError("upstream busy") === "upstream busy",
);

ok("null error", formatProviderError(null) === "unknown");

const userId = randomUUID();
const sessionId = randomUUID();
const jobId = randomUUID();
db.prepare(
  `INSERT INTO users (id, email, password_hash, credits) VALUES (?, ?, 'hash', 100)`,
).run(userId, `test-${jobId.slice(0, 8)}@example.com`);
db.prepare(
  `INSERT INTO image_sessions (id, user_id, title) VALUES (?, ?, 'test')`,
).run(sessionId, userId);
db.prepare(
  `INSERT INTO generation_jobs (id, session_id, user_id, model_id, prompt, mode, count, resolution, status, points_cost)
   VALUES (?, ?, ?, 'agnes-video', 'test', 'chat', 1, '1k', 'running', 10)`,
).run(jobId, sessionId, userId);

setJobProviderTaskId(jobId, "task_test_abc123");
const job = getJob(jobId);
ok(
  "provider_task_id persisted",
  job.provider_task_id === "task_test_abc123",
);

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} 通过\n`);
process.exit(failed > 0 ? 1 : 0);
