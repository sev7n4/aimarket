/**
 * 短剧制作失败重试单测
 * pnpm exec tsx scripts/test-drama-produce-retry.ts
 */
import { randomUUID } from "node:crypto";
import { db } from "../apps/api/src/db/index.js";
import {
  resetProgressFromStep,
  retryDramaRun,
} from "../apps/api/src/lib/drama/executor.ts";
import { createDramaProject } from "../apps/api/src/lib/drama/projects.ts";
import {
  createDramaRun,
  defaultProgress,
  getDramaRun,
  parseProgress,
  updateDramaRun,
} from "../apps/api/src/lib/drama/runs.ts";
import type { DramaProjectData } from "../apps/api/src/lib/drama/schema.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

function createVerifiedUser(credits: number): string {
  const id = randomUUID();
  const email = `retry-${id.slice(0, 8)}@test.local`;
  db.prepare(
    `INSERT INTO users (id, email, password_hash, credits, email_verified_at)
     VALUES (?, ?, 'hash', ?, datetime('now'))`,
  ).run(id, email, credits);
  return id;
}

function createSession(userId: string): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO image_sessions (id, user_id, title, mode, status)
     VALUES (?, ?, 'test', 'chat', 'idle')`,
  ).run(id, userId);
  return id;
}

const minimalProject: DramaProjectData = {
  userIdea: "测试短剧重试逻辑",
  targetDurationSec: 90,
  script: {
    title: "重试测试",
    logline: "失败后可重试",
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
      dialogue: [],
      visualPrompt: "主角微笑",
      motionPrompt: "轻微点头",
      cameraSpec: { shotSize: "MS", movement: "固定", lighting: "自然光" },
      durationSec: 5,
      useLastFrameContinuity: false,
      status: "pending",
    },
  ],
  productionParams: { previewTier: "low", aspectRatio: "9:16" },
};

ok(
  "resetProgressFromStep char_refs resets indices",
  (() => {
    const prior = {
      ...defaultProgress(),
      currentPipelineStep: "keyframes" as const,
      charRefIndex: 1,
      charRefAngleIndex: 2,
      shotIndex: 3,
    };
    const next = resetProgressFromStep("char_refs", prior);
    return (
      next.currentPipelineStep === "char_refs" &&
      next.charRefIndex === 0 &&
      next.charRefAngleIndex === 0 &&
      next.shotIndex === 0
    );
  })(),
);

ok(
  "resetProgressFromStep keeps keyframeRetries",
  (() => {
    const prior = {
      ...defaultProgress(),
      keyframeRetries: { shot1: 1 },
    };
    const next = resetProgressFromStep("keyframes", prior);
    return next.keyframeRetries.shot1 === 1;
  })(),
);

const userId = createVerifiedUser(10_000);
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
  status: "failed",
  error: "模拟 char_refs 失败",
  pendingJobId: null,
  progress: {
    ...parseProgress(runRow),
    currentPipelineStep: "char_refs",
    charRefIndex: 0,
    charRefAngleIndex: 0,
  },
  currentStepIndex: 0,
});

(async () => {
  let retryRejected = false;
  try {
    await retryDramaRun(userId, randomUUID());
  } catch {
    retryRejected = true;
  }
  ok("retry rejects missing run", retryRejected);

  let stillFailed = true;
  try {
    await retryDramaRun(userId, runRow.id);
    const after = getDramaRun(userId, runRow.id)!;
    stillFailed = after.status === "failed";
  } catch {
    stillFailed = true;
  }
  ok("retry on failed run leaves active status", !stillFailed);

  const afterRetry = getDramaRun(userId, runRow.id)!;
  ok(
    "retry clears error field",
    afterRetry.error == null || afterRetry.error !== "模拟 char_refs 失败",
  );
  ok(
    "retry status is active (not failed)",
    afterRetry.status !== "failed" &&
      ["queued", "running", "waiting_job"].includes(afterRetry.status),
  );

  updateDramaRun(runRow.id, {
    status: "failed",
    error: "keyframes 失败",
    progress: {
      ...parseProgress(afterRetry),
      currentPipelineStep: "keyframes",
      shotIndex: 1,
    },
    currentStepIndex: 2,
  });

  await retryDramaRun(userId, runRow.id, "char_refs");
  const fromStepRetry = getDramaRun(userId, runRow.id)!;
  const fromStepProgress = parseProgress(fromStepRetry);
  ok(
    "fromStep retry resets currentPipelineStep",
    fromStepProgress.currentPipelineStep === "char_refs",
  );
  ok(
    "fromStep retry resets charRefIndex",
    fromStepProgress.charRefIndex === 0,
  );

  const failed = results.filter((r) => !r.pass);
  if (failed.length) {
    console.error("\nFailed:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
  console.log(`\n${results.length} passed`);
})();
