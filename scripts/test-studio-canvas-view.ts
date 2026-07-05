#!/usr/bin/env node
/**
 * Studio 画布模式决策纯函数单测（纯逻辑，无需 API）
 * pnpm exec tsx scripts/test-studio-canvas-view.ts
 *
 * 本测试锁定「迁移前」的现状行为（零行为变更基线）。
 * 注意：其中 image/video/chat 模式默认走 Infinite 的用例，
 * 属于当前已知设计冲突（详见审视结论），后续 PR 将变更并同步更新本测试。
 */
import {
  resolveDramaPhaseSplitEnabled,
  resolveUseInfiniteCanvas,
  type CanvasViewInput,
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

const base: CanvasViewInput = {
  creationLane: "image",
  studioMode: "image",
  canvasFlowEnabled: true,
  viewPhase: "agent",
  isDramaPlanActive: false,
};

// --- isDramaPlanActive 优先级最高：始终 Scroll ---
assertEq(
  "plan active forces scroll even in production workflow",
  resolveUseInfiniteCanvas({
    ...base,
    studioMode: "production",
    creationLane: "agent",
    viewPhase: "workflow",
    isDramaPlanActive: true,
  }),
  false,
);

// --- 制片模式：仅 agent 车道 + flow + workflow 才 Infinite ---
assertEq(
  "production agent flow workflow -> infinite",
  resolveUseInfiniteCanvas({
    ...base,
    studioMode: "production",
    creationLane: "agent",
    canvasFlowEnabled: true,
    viewPhase: "workflow",
  }),
  true,
);
assertEq(
  "production agent flow agent-phase -> scroll",
  resolveUseInfiniteCanvas({
    ...base,
    studioMode: "production",
    creationLane: "agent",
    canvasFlowEnabled: true,
    viewPhase: "agent",
  }),
  false,
);
assertEq(
  "production image lane workflow -> scroll (phase split needs agent lane)",
  resolveUseInfiniteCanvas({
    ...base,
    studioMode: "production",
    creationLane: "image",
    canvasFlowEnabled: true,
    viewPhase: "workflow",
  }),
  false,
);
assertEq(
  "production agent no-flow -> scroll",
  resolveUseInfiniteCanvas({
    ...base,
    studioMode: "production",
    creationLane: "agent",
    canvasFlowEnabled: false,
    viewPhase: "workflow",
  }),
  false,
);

// --- 非制片模式：直接跟随 canvasFlowEnabled（当前设计：默认 Infinite） ---
assertEq(
  "image mode flow=true -> infinite (current known conflict)",
  resolveUseInfiniteCanvas({ ...base, studioMode: "image", canvasFlowEnabled: true }),
  true,
);
assertEq(
  "image mode flow=false -> scroll",
  resolveUseInfiniteCanvas({ ...base, studioMode: "image", canvasFlowEnabled: false }),
  false,
);
assertEq(
  "chat mode flow=true -> infinite",
  resolveUseInfiniteCanvas({ ...base, studioMode: "chat", canvasFlowEnabled: true }),
  true,
);
assertEq(
  "image mode + agent lane flow=true -> infinite (no phase split off production)",
  resolveUseInfiniteCanvas({
    ...base,
    studioMode: "image",
    creationLane: "agent",
    canvasFlowEnabled: true,
  }),
  true,
);

// --- resolveDramaPhaseSplitEnabled ---
assertEq(
  "phase split: agent + production + flow",
  resolveDramaPhaseSplitEnabled({
    creationLane: "agent",
    studioMode: "production",
    canvasFlowEnabled: true,
  }),
  true,
);
assertEq(
  "phase split off: image lane",
  resolveDramaPhaseSplitEnabled({
    creationLane: "image",
    studioMode: "production",
    canvasFlowEnabled: true,
  }),
  false,
);
assertEq(
  "phase split off: non-production",
  resolveDramaPhaseSplitEnabled({
    creationLane: "agent",
    studioMode: "image",
    canvasFlowEnabled: true,
  }),
  false,
);
assertEq(
  "phase split off: flow disabled",
  resolveDramaPhaseSplitEnabled({
    creationLane: "agent",
    studioMode: "production",
    canvasFlowEnabled: false,
  }),
  false,
);

const failed = results.filter((r) => !r.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} test(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${results.length} studio-canvas-view tests passed.`);
