/**
 * OpenAPI 鉴权与 Session（PROD-C01）
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-open-api-sessions.ts
 */
import { randomUUID } from "node:crypto";
import { db } from "../apps/api/src/db/index.js";
import { assertSessionRead } from "../apps/api/src/lib/session-access.ts";
import {
  createOpenApiKey,
  resolveOpenApiKey,
  revokeOpenApiKey,
} from "../apps/api/src/lib/open-api-keys.ts";
import {
  createOpenSession,
  serializeOpenSession,
} from "../apps/api/src/lib/open-sessions.ts";
import { AppError } from "../apps/api/src/lib/errors.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

function createVerifiedUser(): string {
  const id = randomUUID();
  const email = `open-api-${id.slice(0, 8)}@test.local`;
  db.prepare(
    `INSERT INTO users (id, email, password_hash, credits, email_verified_at)
     VALUES (?, ?, 'hash', 10000, datetime('now'))`,
  ).run(id, email);
  return id;
}

const userId = createVerifiedUser();
const { key, id: keyId } = createOpenApiKey(userId, "integration-test");

const resolved = resolveOpenApiKey(key);
ok("resolve valid key", resolved?.userId === userId);
ok("invalid key rejected", resolveOpenApiKey("moyu_sk_bad") === null);

const session = createOpenSession(userId, {
  mode: "production",
  title: "外部 Agent 制片",
  kind: "canvas",
});
ok("session mode production", session.mode === "production");
ok("session has id", Boolean(session.id));

const read = assertSessionRead(userId, session.id);
ok("owner can read", serializeOpenSession(read).title === "外部 Agent 制片");

const otherUser = createVerifiedUser();
let otherReadFailed = false;
try {
  assertSessionRead(otherUser, session.id);
} catch (err) {
  otherReadFailed = err instanceof AppError && err.status === 404;
}
ok("other user cannot read", otherReadFailed);

revokeOpenApiKey(userId, keyId);
ok("revoked key rejected", resolveOpenApiKey(key) === null);

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error("\nFailed:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
console.log(`\n${results.length} passed`);
