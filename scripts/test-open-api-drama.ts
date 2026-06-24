/**
 * OpenAPI Plan/Produce/Webhook（PROD-C02）
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-open-api-drama.ts
 */
import { randomUUID } from "node:crypto";
import { db } from "../apps/api/src/db/index.js";
import { AppError } from "../apps/api/src/lib/errors.ts";
import { createOpenApiKey } from "../apps/api/src/lib/open-api-keys.ts";
import {
  openDramaPlanBodySchema,
  openDramaProduceBodySchema,
  startOpenDramaPlan,
  startOpenDramaProduce,
} from "../apps/api/src/lib/open-drama.ts";
import { createOpenSession } from "../apps/api/src/lib/open-sessions.ts";
import {
  OPEN_WEBHOOK_EVENTS,
  listActiveOpenWebhooks,
  registerOpenWebhook,
} from "../apps/api/src/lib/open-webhooks.ts";
import { createDramaProject } from "../apps/api/src/lib/drama/projects.ts";
import type { DramaProjectData } from "../apps/api/src/lib/drama/schema.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

function createVerifiedUser(): string {
  const id = randomUUID();
  const email = `open-drama-${id.slice(0, 8)}@test.local`;
  db.prepare(
    `INSERT INTO users (id, email, password_hash, credits, email_verified_at)
     VALUES (?, ?, 'hash', 10000, datetime('now'))`,
  ).run(id, email);
  return id;
}

const lockedProject = (): DramaProjectData => ({
  projectType: "short_drama",
  userIdea: "OpenAPI 外部制片测试项目",
  targetDurationSec: 90,
  script: {
    title: "Open 测试",
    logline: "Webhook 与 Produce",
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
});

const userId = createVerifiedUser();
createOpenApiKey(userId, "drama-test");
const session = createOpenSession(userId, {
  mode: "production",
  title: "Open Drama",
  kind: "canvas",
});

const planBody = openDramaPlanBodySchema.parse({
  sessionId: session.id,
  userIdea: "都市逆袭短剧，主角从外卖员成长为科技创业者",
  targetDurationSec: 90,
  aspectRatio: "9:16",
  projectType: "short_drama",
});
const plan = startOpenDramaPlan(userId, planBody);
ok("plan run created", plan.status === "planning" && plan.sessionId === session.id);
ok("plan run has id", Boolean(plan.id));

const webhook = registerOpenWebhook(userId, {
  url: "https://example.com/hooks/moyu",
  events: ["drama.plan.completed", "drama.run.completed"],
  secret: "test-secret-12345678",
});
ok("webhook registered", webhook.events.length === 2);
ok("webhook secret returned once", webhook.secret.startsWith("test-secret"));
ok(
  "webhook persisted",
  listActiveOpenWebhooks(userId).length === 1,
);
ok(
  "webhook events enum",
  OPEN_WEBHOOK_EVENTS.includes("drama.plan.failed"),
);

const projectRow = createDramaProject({
  sessionId: session.id,
  userId,
  project: lockedProject(),
});

const produceBody = openDramaProduceBodySchema.parse({
  sessionId: session.id,
  projectId: projectRow.id,
  confirmed: true,
});
const run = startOpenDramaProduce(userId, produceBody);
ok("produce run created", Boolean(run.id));
ok("produce run queued or running", run.status !== "waiting_confirm");

const otherUser = createVerifiedUser();
let otherProduceBlocked = false;
try {
  startOpenDramaProduce(otherUser, produceBody);
} catch (err) {
  otherProduceBlocked = err instanceof AppError && err.status === 404;
}
ok("other user cannot produce foreign project", otherProduceBlocked);

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error("\nFailed:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
console.log(`\n${results.length} passed`);
