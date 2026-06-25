/**
 * 导演质检 Agent（PROD-C03）
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-drama-qc.ts
 */
import { randomUUID } from "node:crypto";
import { db } from "../apps/api/src/db/index.js";
import { AppError } from "../apps/api/src/lib/errors.ts";
import {
  buildDramaQcReport,
  getDramaRunQc,
  runDramaRunQc,
} from "../apps/api/src/lib/drama/planner/qc-director.ts";
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
  db.prepare(
    `INSERT INTO users (id, email, password_hash, credits, email_verified_at)
     VALUES (?, ?, 'hash', 10000, datetime('now'))`,
  ).run(id, `qc-${id.slice(0, 8)}@test.local`);
  return id;
}

function createSession(userId: string): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO image_sessions (id, user_id, title, mode, status)
     VALUES (?, ?, 'qc-test', 'production', 'idle')`,
  ).run(id, userId);
  return id;
}

const project: DramaProjectData = {
  projectType: "short_drama",
  userIdea: "质检测试短剧",
  targetDurationSec: 90,
  script: {
    title: "质检片",
    logline: "测试叙事与一致性评分",
    acts: [],
    narratorLines: [],
  },
  styleBible: {
    palette: ["warm"],
    lightingStyle: "soft",
    aspectRatio: "9:16",
    negativePrompt: "",
  },
  characters: [
    {
      id: "c1",
      name: "主角",
      personalityTone: "开朗",
      promptAnchor: "年轻女性",
      visualSignature: {
        ageRange: "20s",
        faceShape: "oval",
        eyeShape: "almond",
        hairStyle: "long",
        skinTone: "fair",
        signatureOutfit: "casual",
        distinguishingFeatures: [],
      },
    },
  ],
  scenes: [
    {
      id: "s1",
      name: "客厅",
      location: "室内",
      atmosphere: "温馨",
      promptAnchor: "现代客厅",
      props: [],
    },
  ],
  shots: [
    {
      id: "shot1",
      order: 0,
      sceneId: "s1",
      characterIds: ["c1"],
      dialogue: [{ characterId: "c1", line: "你好" }],
      visualPrompt: "主角微笑特写",
      motionPrompt: "轻微点头",
      cameraSpec: { shotSize: "CU", movement: "固定", lighting: "自然光" },
      durationSec: 5,
      useLastFrameContinuity: false,
      status: "done",
      auditScore: { character: 88, style: 82 },
    },
    {
      id: "shot2",
      order: 1,
      sceneId: "s1",
      characterIds: ["c1"],
      dialogue: [],
      visualPrompt: "全景拉开",
      motionPrompt: "缓慢拉镜",
      cameraSpec: { shotSize: "WS", movement: "拉", lighting: "自然光" },
      durationSec: 6,
      useLastFrameContinuity: true,
      status: "done",
      auditScore: { character: 76, style: 80 },
    },
  ],
  productionParams: { previewTier: "low", aspectRatio: "9:16" },
};

const report = buildDramaQcReport(project);
ok("build rule qc report", report.status === "completed");
ok("overall score in range", report.overallScore >= 70 && report.overallScore <= 100);
ok("two shot scores", report.shots.length === 2);
ok("provider rule+audit", report.provider === "rule+audit");

const userId = createVerifiedUser();
const sessionId = createSession(userId);
const projectRow = createDramaProject({ sessionId, userId, project });
const run = createDramaRun({
  sessionId,
  userId,
  projectId: projectRow.id,
  confirmed: true,
});
updateDramaRun(run.id, { status: "completed" });

async function main() {
  let incompleteBlocked = false;
  try {
    await runDramaRunQc(userId, randomUUID());
  } catch (err) {
    incompleteBlocked = err instanceof AppError && err.status === 404;
  }
  ok("missing run rejected", incompleteBlocked);

  const qc = await runDramaRunQc(userId, run.id);
  ok("run qc completed", qc.status === "completed");
  ok("qc persisted", getDramaRunQc(userId, run.id).overallScore === qc.overallScore);

  const row = getDramaRun(userId, run.id)!;
  ok("serialize includes qcReport", Boolean(row.qc_report_json));

  const failed = results.filter((r) => !r.pass);
  if (failed.length) {
    console.error("\nFailed:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
  console.log(`\n${results.length} passed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
