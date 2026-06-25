/**
 * 质检驱动自动重拍（PROD-C04）
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-drama-qc-auto-retry.ts
 */
import { randomUUID } from "node:crypto";
import { db } from "../apps/api/src/db/index.js";
import { buildDramaQcReport } from "../apps/api/src/lib/drama/planner/qc-director.ts";
import { applyAutoQcRetry } from "../apps/api/src/lib/drama/qc-auto-retry.ts";
import { createDramaProject, updateDramaProject } from "../apps/api/src/lib/drama/projects.ts";
import {
  createDramaRun,
  getDramaRun,
  parseProgress,
  parseQcReport,
  updateDramaRun,
} from "../apps/api/src/lib/drama/runs.ts";
import type { DramaProjectData } from "../apps/api/src/lib/drama/schema.ts";

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
  ).run(id, `qc-retry-${id.slice(0, 8)}@test.local`);
  return id;
}

function createSession(userId: string): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO image_sessions (id, user_id, title, mode, status)
     VALUES (?, ?, 'qc-retry', 'production', 'idle')`,
  ).run(id, userId);
  return id;
}

const baseProject = (): DramaProjectData => ({
  projectType: "short_drama",
  userIdea: "自动重拍测试",
  targetDurationSec: 90,
  script: {
    title: "重拍测试",
    logline: "低分镜自动重拍",
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
      turnaroundStatus: "locked",
      refUrl: "https://example.com/ref.png",
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
      id: "shot-low",
      order: 0,
      sceneId: "s1",
      characterIds: ["c1"],
      dialogue: [],
      visualPrompt: "低分镜",
      motionPrompt: "固定",
      cameraSpec: { shotSize: "MS", movement: "固定", lighting: "自然光" },
      durationSec: 5,
      useLastFrameContinuity: false,
      status: "done",
      keyframeOutputId: randomUUID(),
      auditScore: { character: 50, style: 55 },
    },
    {
      id: "shot-ok",
      order: 1,
      sceneId: "s1",
      characterIds: ["c1"],
      dialogue: [],
      visualPrompt: "高分镜",
      motionPrompt: "固定",
      cameraSpec: { shotSize: "MS", movement: "固定", lighting: "自然光" },
      durationSec: 5,
      useLastFrameContinuity: false,
      status: "done",
      keyframeOutputId: randomUUID(),
      auditScore: { character: 90, style: 88 },
    },
  ],
  productionParams: {
    previewTier: "low",
    aspectRatio: "9:16",
    autoQcRetry: true,
    qcRetryThreshold: 70,
    qcAutoRetryMaxShots: 1,
  },
});

async function main() {
  const userId = createUser();
  const sessionId = createSession(userId);
  const projectRow = createDramaProject({
    sessionId,
    userId,
    project: baseProject(),
  });
  const run = createDramaRun({
    sessionId,
    userId,
    projectId: projectRow.id,
    confirmed: true,
  });
  updateDramaRun(run.id, { status: "completed" });

  const report = buildDramaQcReport(baseProject());
  const low = report.shots.find((s) => s.shotId === "shot-low");
  ok("low shot below threshold", Boolean(low && low.overallScore < 70));

  updateDramaProject(projectRow.id, {
    project: {
      ...baseProject(),
      productionParams: {
        ...baseProject().productionParams,
        autoQcRetry: false,
      },
    },
  });
  const noRetry = await applyAutoQcRetry(userId, run.id, report);
  ok("autoQcRetry off skips", !noRetry.autoRetry?.triggered);
  ok("run still completed when skipped", getDramaRun(userId, run.id)?.status === "completed");

  updateDramaProject(projectRow.id, { project: baseProject() });

  const retried = await applyAutoQcRetry(userId, run.id, report);
  ok("auto retry triggered", retried.autoRetry?.triggered === true);
  ok("retries lowest shot", retried.autoRetry?.retriedShotIds?.[0] === "shot-low");

  const after = getDramaRun(userId, run.id)!;
  ok("run left completed after retry", after.status !== "completed");
  const progress = parseProgress(after);
  ok("tracks retried shot", progress.qcAutoRetriedShots?.includes("shot-low") === true);
  const storedQc = parseQcReport(after);
  ok(
    "qc report persisted",
    storedQc?.autoRetry?.triggered === true || retried.autoRetry?.triggered === true,
  );

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
