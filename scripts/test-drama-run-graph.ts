/**
 * 短剧制作 Run DAG 图（PROD-B01）
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-drama-run-graph.ts
 */
import { randomUUID } from "node:crypto";
import { db } from "../apps/api/src/db/index.js";
import { buildDramaRunGraph } from "../apps/api/src/lib/drama/run-graph.ts";
import { createDramaProject } from "../apps/api/src/lib/drama/projects.ts";
import {
  createDramaRun,
  getDramaRun,
  updateDramaRun,
} from "../apps/api/src/lib/drama/runs.ts";
import { DRAMA_PIPELINE_STEPS } from "../apps/api/src/lib/drama/schema.ts";
import type { DramaProjectData } from "../apps/api/src/lib/drama/schema.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

function createVerifiedUser(): string {
  const id = randomUUID();
  const email = `graph-${id.slice(0, 8)}@test.local`;
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
     VALUES (?, ?, 'graph-test', 'chat', 'idle')`,
  ).run(id, userId);
  return id;
}

const minimalProject: DramaProjectData = {
  projectType: "short_drama",
  userIdea: "DAG 图测试",
  targetDurationSec: 90,
  script: {
    title: "节点流",
    logline: "只读 DAG",
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

updateDramaRun(runRow.id, {
  status: "running",
  currentStepIndex: 2,
});

const runningRow = getDramaRun(userId, runRow.id)!;
const graph = buildDramaRunGraph(runningRow, projectRow);

ok("graph has all pipeline nodes", graph.nodes.length === DRAMA_PIPELINE_STEPS.length);
ok("graph skillId", graph.skillId === "drama-short-v1");
ok("graph runId", graph.runId === runRow.id);
ok(
  "running step is keyframes",
  graph.nodes.find((n) => n.id === "keyframes")?.status === "running",
);
ok(
  "prior steps done",
  graph.nodes.filter((n) => n.index < 2).every((n) => n.status === "done"),
);
ok(
  "later steps pending",
  graph.nodes.filter((n) => n.index > 2).every((n) => n.status === "pending"),
);
ok("concat node present", graph.nodes.some((n) => n.id === "concat"));
ok("concat maps final_edit stepId", graph.nodes.find((n) => n.id === "concat")?.stepId === "final_edit");
ok("edges non-empty", graph.edges.length > 0);

updateDramaRun(runRow.id, {
  status: "completed",
  currentStepIndex: DRAMA_PIPELINE_STEPS.length,
});
const completedRow = getDramaRun(userId, runRow.id)!;
const completedGraph = buildDramaRunGraph(completedRow, projectRow);
ok(
  "completed run all nodes done",
  completedGraph.nodes.every((n) => n.status === "done"),
);

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error("\nFailed:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
console.log(`\n${results.length} passed`);
