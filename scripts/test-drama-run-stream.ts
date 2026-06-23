/**
 * 短剧制作 Run SSE 事件测试
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-drama-run-stream.ts
 */
import { randomUUID } from "node:crypto";
import { db } from "../apps/api/src/db/index.js";
import {
  clearRunEvents,
  getRunEventBuffer,
  isTerminalRunEvent,
} from "../apps/api/src/lib/drama/run-events.js";
import { publishDramaRunStreamUpdate } from "../apps/api/src/lib/drama/run-stream.js";
import { createDramaProject } from "../apps/api/src/lib/drama/projects.ts";
import {
  createDramaRun,
  getDramaRun,
  updateDramaRun,
} from "../apps/api/src/lib/drama/runs.ts";
import type { DramaProjectData } from "../apps/api/src/lib/drama/schema.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

function createVerifiedUser(): string {
  const id = randomUUID();
  const email = `stream-${id.slice(0, 8)}@test.local`;
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
     VALUES (?, ?, 'stream-test', 'chat', 'idle')`,
  ).run(id, userId);
  return id;
}

const minimalProject: DramaProjectData = {
  userIdea: "SSE 测试",
  targetDurationSec: 60,
  script: {
    title: "节点流",
    logline: "SSE",
    acts: [],
    narratorLines: [],
  },
  styleBible: {
    palette: ["warm"],
    lightingStyle: "soft",
    aspectRatio: "9:16",
    negativePrompt: "",
  },
  characters: [],
  scenes: [],
  shots: [],
  productionParams: { previewTier: "low", aspectRatio: "9:16" },
};

const userId = createVerifiedUser();
const sessionId = createSession(userId);
const projectRow = createDramaProject({
  sessionId,
  userId,
  project: minimalProject,
});
const runRow = createDramaRun({
  sessionId,
  userId,
  projectId: projectRow.id,
  confirmed: true,
});

const afterCreate = getRunEventBuffer(runRow.id);
ok("create publishes graph_update", afterCreate.some((e) => e.type === "graph_update"));

clearRunEvents(runRow.id);
updateDramaRun(runRow.id, { status: "running", currentStepIndex: 1 });
publishDramaRunStreamUpdate(runRow.id);

const afterStep = getRunEventBuffer(runRow.id);
const graphEvent = afterStep.find((e) => e.type === "graph_update");
ok("step update publishes graph", Boolean(graphEvent));
ok(
  "running node is scene_refs",
  graphEvent?.type === "graph_update" &&
    graphEvent.graph.nodes.find((n) => n.id === "scene_refs")?.status ===
      "running",
);

updateDramaRun(runRow.id, { status: "completed", currentStepIndex: 8 });
publishDramaRunStreamUpdate(runRow.id);
const afterDone = getRunEventBuffer(runRow.id);
ok(
  "completed publishes run_complete",
  afterDone.some((e) => e.type === "run_complete"),
);
ok(
  "terminal guard avoids duplicate run_complete",
  afterDone.filter((e) => e.type === "run_complete").length === 1,
);

updateDramaRun(runRow.id, { status: "failed", error: "模拟失败" });
clearRunEvents(runRow.id);
publishDramaRunStreamUpdate(runRow.id);
ok(
  "failed publishes run_failed",
  getRunEventBuffer(runRow.id).some((e) => e.type === "run_failed"),
);
ok(
  "isTerminalRunEvent",
  isTerminalRunEvent({ type: "run_failed", runId: runRow.id, error: "x" }),
);

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error("\nFailed:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
console.log(`\n${results.length} passed`);
