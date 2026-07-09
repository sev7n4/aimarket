/**
 * story-canvas 分享克隆单测
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-story-canvas-share.ts
 */
import { randomUUID } from "node:crypto";
import { db } from "../apps/api/src/db/index.js";
import {
  cloneStoryCanvasShare,
  toggleStoryCanvasShare,
  viewStoryCanvasShare,
} from "../apps/api/src/lib/story-canvas-share-service.ts";
import { serializeCanvasLayout } from "../apps/api/src/lib/canvas-layout.ts";

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
  ).run(id, `share-${id.slice(0, 8)}@test.local`);
  return id;
}

function createSession(userId: string, layout?: string): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO image_sessions (id, user_id, title, mode, kind, canvas_layout, status)
     VALUES (?, ?, '分享测试', 'chat', 'canvas', ?, 'idle')`,
  ).run(id, userId, layout ?? null);
  return id;
}

const ownerId = createUser();
const layout = serializeCanvasLayout({
  version: 1,
  items: [
    {
      id: "wf-node-1",
      url: "",
      x: 10,
      y: 20,
      width: 200,
      height: 200,
      infiniteNodeType: "workflow",
      infiniteNodeMeta: { workflowToolType: "TEXT_TO_IMAGE", status: "idle" },
    },
  ],
});
const sessionId = createSession(ownerId, layout);

const toggle = toggleStoryCanvasShare(ownerId, { sessionId, enabled: true });
ok("toggle enabled", toggle.enabled === true);
const token = toggle.shareUrl?.split("/").pop() ?? "";
ok("share url token", token.length > 10);

const view = viewStoryCanvasShare(token);
ok("view layout items", (view.canvasLayout as { items?: unknown[] })?.items?.length === 1);

const clonerId = createUser();
const cloned = cloneStoryCanvasShare(clonerId, { token });
ok("clone session", Boolean(cloned.sessionId));
const clonedRow = db
  .prepare(`SELECT canvas_layout FROM image_sessions WHERE id = ?`)
  .get(cloned.sessionId) as { canvas_layout: string | null };
ok("clone has layout", Boolean(clonedRow?.canvas_layout?.includes("wf-node-1")));

const failed = results.filter((r) => !r.pass);
if (failed.length) process.exit(1);
console.log(`\n${results.length} passed`);
