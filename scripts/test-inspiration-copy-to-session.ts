/**
 * 灵感 → 制片 Session Copy（PROD-B06）
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-inspiration-copy-to-session.ts
 */
import { randomUUID } from "node:crypto";
import { db } from "../apps/api/src/db/index.js";
import { copyProductionSessionFromInspiration } from "../apps/api/src/lib/inspiration-fork.ts";
import { dramaTemplateMetadataSchema } from "../apps/api/src/lib/inspiration.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

function createVerifiedUser(): string {
  const id = randomUUID();
  const email = `insp-copy-${id.slice(0, 8)}@test.local`;
  db.prepare(
    `INSERT INTO users (id, email, password_hash, credits, email_verified_at)
     VALUES (?, ?, 'hash', 10000, datetime('now'))`,
  ).run(id, email);
  return id;
}

const userId = createVerifiedUser();
const inspirationId = randomUUID();
const dramaTemplate = dramaTemplateMetadataSchema.parse({
  userIdea: "都市爱情短剧：雨夜咖啡店重逢与和解",
  projectType: "short_drama",
  targetDurationSec: 90,
  aspectRatio: "9:16",
  scriptTitle: "雨夜咖啡",
  logline: "误会与和解",
});

db.prepare(
  `INSERT INTO inspiration_templates (
    id, legacy_id, title, category, prompt_template, model_id,
    aspect_ratio, resolution, cover_url, status, sort_order, drama_template_json
  ) VALUES (?, 99001, '制片模板测试', '制片', ?, 'wan-2.6', '9:16', '1k', 'https://example.com/cover.jpg', 'published', -99001, ?)`,
).run(
  inspirationId,
  dramaTemplate.logline ?? dramaTemplate.userIdea,
  JSON.stringify(dramaTemplate),
);

const copied = copyProductionSessionFromInspiration(userId, inspirationId);
ok("session mode production", copied.session.mode === "production");
ok("session kind canvas", copied.session.kind === "canvas");
ok("source inspiration linked", copied.session.source_inspiration_id === inspirationId);
ok("dramaTemplate userIdea", copied.dramaTemplate.userIdea === dramaTemplate.userIdea);
ok("dramaTemplate projectType", copied.dramaTemplate.projectType === "short_drama");

let threw = false;
try {
  copyProductionSessionFromInspiration(userId, randomUUID());
} catch {
  threw = true;
}
ok("missing inspiration throws", threw);

const noTemplateId = randomUUID();
db.prepare(
  `INSERT INTO inspiration_templates (
    id, legacy_id, title, category, prompt_template, model_id,
    aspect_ratio, resolution, cover_url, status, sort_order
  ) VALUES (?, 99002, '无模板', '创意', 'prompt', 'seedream-5', '1:1', '1k', 'https://example.com/c.jpg', 'published', -99002)`,
).run(noTemplateId);

let noTplThrew = false;
try {
  copyProductionSessionFromInspiration(userId, noTemplateId);
} catch (err) {
  noTplThrew =
    err instanceof Error && err.message.includes("制片模板");
}
ok("no drama template rejects", noTplThrew);

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error("\nFailed:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
console.log(`\n${results.length} passed`);
