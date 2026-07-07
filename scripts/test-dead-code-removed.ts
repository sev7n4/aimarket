#!/usr/bin/env node
/**
 * P6-0：确认已删除模块无代码引用
 * pnpm exec tsx scripts/test-dead-code-removed.ts
 */
import { execSync } from "node:child_process";

const BANNED = [
  "workbench-panel",
  "WorkbenchPanel",
  "use-creation-lane-state",
  "useCreationLaneState",
] as const;

const results: { name: string; pass: boolean; detail?: string }[] = [];

function ok(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

for (const token of BANNED) {
  let hits = "";
  try {
    hits = execSync(
      `rg -l --glob '!docs/**' --glob '!scripts/test-dead-code-removed.ts' "${token}" apps/web/src packages 2>/dev/null || true`,
      { encoding: "utf8", cwd: process.cwd() },
    ).trim();
  } catch {
    hits = "";
  }
  ok(`no code refs: ${token}`, hits.length === 0, hits || undefined);
}

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error(`\n${failed.length} failed`);
  process.exit(1);
}
console.log(`\n${results.length} passed`);
