/**
 * 短剧制作节点局部重跑（PROD-B03）
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-drama-run-node-rerun.ts
 */
import { randomUUID } from "node:crypto";
import { db } from "../apps/api/src/db/index.js";
import {
  invalidateProjectOutputsFromStep,
  rerunDramaRunFromNode,
} from "../apps/api/src/lib/drama/executor.ts";
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
  const email = `node-rerun-${id.slice(0, 8)}@test.local`;
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
     VALUES (?, ?, 'node-rerun-test', 'chat', 'idle')`,
  ).run(id, userId);
  return id;
}

function buildShots(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `shot-${i + 1}`,
    order: i,
    sceneId: "scene-1",
    characterIds: ["char-1"],
    dialogue: [],
    visualPrompt: `画面 ${i + 1}`,
    motionPrompt: `运动 ${i + 1}`,
    cameraSpec: { shotSize: "MS", movement: "static", lighting: "soft" },
    durationSec: 5,
    useLastFrameContinuity: false,
    status: "done" as const,
    keyframeOutputId: randomUUID(),
    videoOutputId: randomUUID(),
  }));
}

const project: DramaProjectData = {
  projectType: "short_drama",
  userIdea: "节点重跑测试",
  targetDurationSec: 90,
  script: {
    title: "重跑",
    logline: "局部重跑",
    acts: [{ act: 1, sceneId: "scene-1", summary: "场次" }],
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
      id: "char-1",
      name: "主角",
      personalityTone: "温和",
      visualSignature: {
        ageRange: "20s",
        faceShape: "oval",
        eyeShape: "almond",
        hairStyle: "short",
        skinTone: "fair",
        signatureOutfit: "casual",
        distinguishingFeatures: [],
      },
      promptAnchor: "主角",
      turnaroundStatus: "locked",
      refOutputIds: {
        front: randomUUID(),
        three_quarter: randomUUID(),
        side: randomUUID(),
      },
    },
  ],
  scenes: [
    {
      id: "scene-1",
      name: "咖啡店",
      location: "室内",
      atmosphere: "雨夜",
      promptAnchor: "咖啡店",
      props: [],
    },
  ],
  shots: buildShots(8),
  productionParams: { previewTier: "low", aspectRatio: "9:16" },
};

const userId = createVerifiedUser();
const sessionId = createSession(userId);
const projectRow = createDramaProject({ sessionId, userId, project });
const runRow = createDramaRun({
  sessionId,
  userId,
  projectId: projectRow.id,
  confirmed: true,
});

async function main() {
  updateDramaRun(runRow.id, {
    status: "completed",
    currentStepIndex: 8,
    finalVideoUrl: "https://example.com/final.mp4",
  });

  const patchedMotion = "节点重跑后的运动描述";
  const next = await rerunDramaRunFromNode(userId, runRow.id, "keyframes", {
    shots: [{ id: "shot-1", motionPrompt: patchedMotion }],
  });

  ok("rerun returns run row", Boolean(next?.id));
  ok("run left completed state", next?.status !== "completed");
  ok("final video cleared on rerun", next?.final_video_url == null);
  ok(
    "motionPrompt patched on shot-1",
    next?.id
      ? (() => {
          const row = db
            .prepare(`SELECT project_json FROM drama_projects WHERE id = ?`)
            .get(projectRow.id) as { project_json: string };
          const data = JSON.parse(row.project_json) as DramaProjectData;
          return data.shots[0]?.motionPrompt === patchedMotion;
        })()
      : false,
  );

  const running = getDramaRun(userId, runRow.id)!;
  updateDramaRun(runRow.id, { status: "running" });
  let threw = false;
  try {
    await rerunDramaRunFromNode(userId, runRow.id, "shot_videos");
  } catch (err) {
    threw = err instanceof Error && err.message === "DRAMA_RUN_NOT_RERUNNABLE";
  }
  updateDramaRun(runRow.id, { status: running.status });
  ok("running run cannot rerun from node", threw);

  const scratch = structuredClone(project);
  invalidateProjectOutputsFromStep(scratch, "keyframes");
  ok(
    "invalidate keyframes clears shot outputs",
    scratch.shots.every(
      (s) => !s.keyframeOutputId && !s.videoOutputId && s.status === "pending",
    ),
  );

  const failed = results.filter((r) => !r.pass);
  if (failed.length) {
    console.error("\nFailed:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
  console.log(`\n${results.length} passed`);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
