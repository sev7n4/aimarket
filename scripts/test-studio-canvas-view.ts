#!/usr/bin/env node
/**
 * Studio 画布模式决策纯函数单测（纯逻辑，无需 API）
 * pnpm exec tsx scripts/test-studio-canvas-view.ts
 *
 * Phase C：固定 ScrollCanvas，节点视图切换与 Drama phase split 已下线。
 */
import {
  resolveCanvasViewToggleEnabled,
  resolveUseInfiniteCanvas,
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

assertEq(
  "always scroll (flow on)",
  resolveUseInfiniteCanvas({ canvasFlowEnabled: true }),
  false,
);
assertEq(
  "always scroll (flow off)",
  resolveUseInfiniteCanvas({ canvasFlowEnabled: false }),
  false,
);
assertEq(
  "view toggle disabled (flow on)",
  resolveCanvasViewToggleEnabled({ canvasFlowEnabled: true }),
  false,
);
assertEq(
  "view toggle disabled (flow off)",
  resolveCanvasViewToggleEnabled({ canvasFlowEnabled: false }),
  false,
);

const failed = results.filter((r) => !r.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} test(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${results.length} studio-canvas-view tests passed.`);
