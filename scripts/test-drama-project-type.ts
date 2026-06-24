/**
 * 项目类型 short_drama | mv | creative（PROD-B05）
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-drama-project-type.ts
 */
import { randomUUID } from "node:crypto";
import { db } from "../apps/api/src/db/index.js";
import { createDramaProject } from "../apps/api/src/lib/drama/projects.ts";
import {
  createDramaPlanRun,
  serializeDramaPlanRun,
} from "../apps/api/src/lib/drama/plan-runs.ts";
import { buildRuleBasedProject } from "../apps/api/src/lib/drama/planner.ts";
import { createDramaRun } from "../apps/api/src/lib/drama/runs.ts";
import { resolveDramaSkillId } from "../apps/api/src/lib/drama/skill-id.ts";
import { loadSkill } from "../packages/agent-skills/src/load.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

function createVerifiedUser(): string {
  const id = randomUUID();
  const email = `ptype-${id.slice(0, 8)}@test.local`;
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
     VALUES (?, ?, 'ptype-test', 'chat', 'idle')`,
  ).run(id, userId);
  return id;
}

ok("short_drama → drama-short-v1", resolveDramaSkillId("short_drama") === "drama-short-v1");
ok("mv → drama-mv-v1", resolveDramaSkillId("mv") === "drama-mv-v1");
ok("creative → drama-mv-v1", resolveDramaSkillId("creative") === "drama-mv-v1");

const mvSkill = loadSkill("drama-mv-v1");
ok("drama-mv-v1 skill loads", mvSkill.id === "drama-mv-v1");

const mvProject = buildRuleBasedProject({
  userIdea: "霓虹节拍 MV",
  projectType: "mv",
});
ok("mv default duration 60s", mvProject.targetDurationSec === 60);
ok("mv shot count 8", mvProject.shots.length === 8);
ok("mv projectType persisted", mvProject.projectType === "mv");
ok("mv title", mvProject.script.title === "AI MV");

const creativeProject = buildRuleBasedProject({
  userIdea: "超现实意象短片",
  projectType: "creative",
});
ok("creative visual prompt", creativeProject.shots[0]!.visualPrompt.includes("超现实"));
ok("creative projectType", creativeProject.projectType === "creative");

const userId = createVerifiedUser();
const sessionId = createSession(userId);

const planRun = createDramaPlanRun({
  sessionId,
  userId,
  userIdea: "MV 规划",
  projectType: "mv",
  targetDurationSec: 60,
});
const serialized = serializeDramaPlanRun(planRun);
ok("plan run projectType mv", serialized.projectType === "mv");

const mvProjectRow = createDramaProject({
  sessionId,
  userId,
  project: {
    ...mvProject,
    productionParams: { previewTier: "low", aspectRatio: "9:16" },
  },
});
const mvRun = createDramaRun({
  sessionId,
  userId,
  projectId: mvProjectRow.id,
  confirmed: true,
});
ok("mv run skill_id", mvRun.skill_id === "drama-mv-v1");

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error("\nFailed:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
console.log(`\n${results.length} passed`);
