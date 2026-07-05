#!/usr/bin/env node
/**
 * Studio 画布模式决策纯函数单测（纯逻辑，无需 API）
 * pnpm exec tsx scripts/test-studio-canvas-view.ts
 *
 * 统一模型：三车道默认 ScrollCanvas，仅用户切到「节点视图」(viewPhase=workflow)
 * 才进入 InfiniteCanvas；canvasFlow 关闭或短剧规划中一律锁定 Scroll。
 * resolveDramaPhaseSplitEnabled 仅决定 Infinite 下是否叠加短剧节点面板。
 */
import {
  resolveCanvasViewToggleEnabled,
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
  canvasFlowEnabled: true,
  viewPhase: "agent",
  isDramaPlanActive: false,
};

// --- 默认（agent 视图）：三车道一律 Scroll ---
assertEq(
  "default agent view -> scroll",
  resolveUseInfiniteCanvas({ ...base, viewPhase: "agent" }),
  false,
);

// --- 用户切到节点视图：进入 Infinite（与车道 / 模式无关） ---
assertEq(
  "workflow view + flow -> infinite",
  resolveUseInfiniteCanvas({ ...base, viewPhase: "workflow" }),
  true,
);

// --- canvasFlow 逃生开关：关闭则锁定 Scroll ---
assertEq(
  "workflow view + flow disabled -> scroll",
  resolveUseInfiniteCanvas({
    ...base,
    viewPhase: "workflow",
    canvasFlowEnabled: false,
  }),
  false,
);

// --- 短剧规划中：优先级最高，强制 Scroll ---
assertEq(
  "plan active forces scroll even in workflow view",
  resolveUseInfiniteCanvas({
    ...base,
    viewPhase: "workflow",
    isDramaPlanActive: true,
  }),
  false,
);

// --- resolveCanvasViewToggleEnabled：随 canvasFlow 开放 ---
assertEq(
  "toggle enabled when flow on",
  resolveCanvasViewToggleEnabled({ canvasFlowEnabled: true }),
  true,
);
assertEq(
  "toggle disabled when flow off",
  resolveCanvasViewToggleEnabled({ canvasFlowEnabled: false }),
  false,
);

// --- resolveDramaPhaseSplitEnabled：短剧节点面板仅 agent + 制片 + flow ---
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
