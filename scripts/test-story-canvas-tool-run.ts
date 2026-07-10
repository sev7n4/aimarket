/**
 * story-canvas 专用工具运行单测
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-story-canvas-tool-run.ts
 */
process.env.IMAGE_PROVIDER = "mock";
process.env.TOOL_IMAGE_PROVIDER = "mock";

import { randomUUID } from "node:crypto";
import { db } from "../apps/api/src/db/index.js";

async function main() {
  const {
    isWorkflowStudioToolType,
    runWorkflowAudio,
    runWorkflowMusic,
    runWorkflowOutpainting,
    runWorkflowUpscale,
  } = await import("../apps/api/src/lib/story-canvas-tool-run.ts");

  const results: { name: string; pass: boolean }[] = [];

  function ok(name: string, pass: boolean) {
    results.push({ name, pass });
    console.log(`${pass ? "✓" : "✗"} ${name}`);
  }

  function createVerifiedUser(): string {
    const id = randomUUID();
    const email = `sc-tool-${id.slice(0, 8)}@test.local`;
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
       VALUES (?, ?, 'tool-run-test', 'chat', 'idle')`,
    ).run(id, userId);
    return id;
  }

  ok("isWorkflowStudioToolType expand", isWorkflowStudioToolType("IMAGE_OUTPAINTING"));
  ok("isWorkflowStudioToolType text", !isWorkflowStudioToolType("TEXT_TO_IMAGE"));

  const userId = createVerifiedUser();
  const sessionId = createSession(userId);
  const nodeKey = `${sessionId}:wf-expand-1`;

  let threwSourceRequired = false;
  try {
    runWorkflowOutpainting(userId, {
      sessionId,
      nodeKey,
      prompt: "向外扩展",
      workflowToolType: "IMAGE_OUTPAINTING",
    });
  } catch (err) {
    threwSourceRequired =
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "SOURCE_REQUIRED";
  }
  ok("outpainting requires reference", threwSourceRequired);

  const expandResult = runWorkflowOutpainting(userId, {
    sessionId,
    nodeKey,
    prompt: "向外扩展",
    workflowToolType: "IMAGE_OUTPAINTING",
    referenceUrls: ["https://example.com/ref.png"],
  });
  ok("outpainting creates job", Boolean(expandResult.jobId));
  const expandJob = db
    .prepare("SELECT tool_type, tool_context FROM generation_jobs WHERE id = ?")
    .get(expandResult.jobId) as { tool_type: string; tool_context: string };
  ok("outpainting tool_type expand", expandJob.tool_type === "expand");
  ok(
    "outpainting stores nodeKey",
    expandJob.tool_context.includes(nodeKey),
  );

  const upscaleResult = runWorkflowUpscale(userId, {
    sessionId,
    nodeKey: `${sessionId}:wf-upscale`,
    referenceUrls: ["https://example.com/ref.png"],
    scale: "2x",
  });
  const upscaleJob = db
    .prepare("SELECT tool_type FROM generation_jobs WHERE id = ?")
    .get(upscaleResult.jobId) as { tool_type: string };
  ok("upscale tool_type", upscaleJob.tool_type === "upscale");

  const musicResult = runWorkflowMusic(userId, {
    sessionId,
    nodeKey: `${sessionId}:wf-music`,
    style: "轻快电子",
    bpm: 128,
    durationSec: 30,
  });
  const musicJob = db
    .prepare("SELECT tool_type, tool_context FROM generation_jobs WHERE id = ?")
    .get(musicResult.jobId) as { tool_type: string; tool_context: string };
  ok("music tool_type", musicJob.tool_type === "music-gen");
  ok("music context style", musicJob.tool_context.includes("轻快电子"));

  const audioResult = runWorkflowAudio(userId, {
    sessionId,
    nodeKey: `${sessionId}:wf-audio`,
    prompt: "你好，这是测试语音",
  });
  const audioJob = db
    .prepare("SELECT tool_type, prompt FROM generation_jobs WHERE id = ?")
    .get(audioResult.jobId) as { tool_type: string; prompt: string };
  ok("audio tool_type tts", audioJob.tool_type === "tts");
  ok("audio prompt preserved", audioJob.prompt.includes("测试语音"));

  const failed = results.filter((r) => !r.pass);
  if (failed.length) {
    console.error("\nFailed:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
  console.log(`\n${results.length} passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
