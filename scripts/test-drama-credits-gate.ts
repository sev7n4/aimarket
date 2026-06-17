/**
 * 短剧积分门控单测
 * pnpm exec tsx scripts/test-drama-credits-gate.ts
 */
import { randomUUID } from "node:crypto";
import { db } from "../apps/api/src/db/index.js";
import { AppError } from "../apps/api/src/lib/errors.js";
import {
  assertDramaCreditsAffordable,
  dramaCreditsAffordability,
  formatDramaInsufficientCreditsMessage,
  getUserCreditBalance,
} from "../apps/api/src/lib/drama/credits-gate.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

function createVerifiedUser(credits: number): string {
  const id = randomUUID();
  const email = `gate-${id.slice(0, 8)}@test.local`;
  db.prepare(
    `INSERT INTO users (id, email, password_hash, credits, email_verified_at)
     VALUES (?, ?, 'hash', ?, datetime('now'))`,
  ).run(id, email, credits);
  return id;
}

ok(
  "format message includes points and balance",
  formatDramaInsufficientCreditsMessage(576, 253).includes("576") &&
    formatDramaInsufficientCreditsMessage(576, 253).includes("253"),
);

const richUser = createVerifiedUser(1000);
const poorUser = createVerifiedUser(253);

ok(
  "affordable when balance >= estimate",
  dramaCreditsAffordability(richUser, 576).ok === true &&
    dramaCreditsAffordability(richUser, 576).shortfall === 0,
);

ok(
  "not affordable when balance < estimate",
  dramaCreditsAffordability(poorUser, 576).ok === false &&
    dramaCreditsAffordability(poorUser, 576).shortfall === 323,
);

ok(
  "getUserCreditBalance reads credits",
  getUserCreditBalance(poorUser) === 253,
);

let threw402 = false;
try {
  assertDramaCreditsAffordable(poorUser, 576);
} catch (err) {
  threw402 =
    err instanceof AppError &&
    err.status === 402 &&
    err.code === "INSUFFICIENT_CREDITS" &&
    err.message.includes("576") &&
    err.message.includes("253");
}
ok("assert throws 402 INSUFFICIENT_CREDITS when short", threw402);

let assertPassed = false;
try {
  assertDramaCreditsAffordable(richUser, 576);
  assertPassed = true;
} catch {
  assertPassed = false;
}
ok("assert passes when balance sufficient", assertPassed);

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error("\nFailed:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
console.log(`\n${results.length} passed`);
