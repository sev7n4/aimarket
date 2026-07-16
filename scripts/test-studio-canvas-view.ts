#!/usr/bin/env node
/**
 * Studio 画布引擎决策纯函数单测（纯逻辑，无需 API）
 * pnpm exec tsx scripts/test-studio-canvas-view.ts
 *
 * Phase D：固定 ScrollCanvas 单引擎。
 */
import {
  resolveCanvasEngine,
  resolveCanvasViewToggleEnabled,
} from "../apps/web/src/lib/studio-canvas-view.ts";

const results: { name: string; pass: boolean; detail?: string }[] = [];

function assertEq<T>(name: string, actual: T, expected: T) {
  const pass = actual === expected;
  results.push({ name, pass });
  const icon = pass ? "✓" : "✗";
  console.log(
    `${icon} ${name}${pass ? "" : ` — got ${String(actual)}, want ${String(expected)}`}`,
  );
}

assertEq("resolveCanvasEngine", resolveCanvasEngine(), "scroll");
assertEq("view toggle disabled", resolveCanvasViewToggleEnabled(), false);

const failed = results.filter((r) => !r.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} test(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${results.length} studio-canvas-view tests passed.`);
