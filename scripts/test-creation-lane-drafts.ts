#!/usr/bin/env node
/**
 * 创作车道 Draft 存储单测（纯逻辑）
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-creation-lane-drafts.ts
 */
import {
  createDefaultScopeLaneDrafts,
  defaultLaneSettingsDraft,
  normalizeLaneModelId,
  patchActiveLaneSettings,
  switchActiveLane,
} from "../apps/web/src/lib/creation-lane-drafts.ts";

const results: { name: string; pass: boolean; detail?: string }[] = [];

function ok(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
  const icon = pass ? "✓" : "✗";
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`);
}

function assertEq<T>(name: string, actual: T, expected: T) {
  ok(name, actual === expected, actual !== expected ? `got ${String(actual)}` : "");
}

const home = createDefaultScopeLaneDrafts("home");
ok("default active lane image", home.activeLane === "image");
ok(
  "image lane auto output",
  home.lanes.image.outputPrefMode === "auto",
);
ok("image lane default model auto", home.lanes.image.modelId === "auto");
ok("agent lane auto output", home.lanes.agent.outputPrefMode === "auto");

assertEq(
  "normalize internal routing slug to auto",
  normalizeLaneModelId("omni-v2"),
  "auto",
);
assertEq(
  "preserve explicit user model",
  normalizeLaneModelId("seedream-5"),
  "seedream-5",
);

const patched = patchActiveLaneSettings(home, {
  aspectRatio: "16:9",
  modelId: "seedream-5",
});
assertEq(
  "patch active image aspect",
  patched.lanes.image.aspectRatio,
  "16:9",
);
assertEq(
  "patch does not touch video lane",
  patched.lanes.video.aspectRatio,
  defaultLaneSettingsDraft("video").aspectRatio,
);

const switched = switchActiveLane(patched, "video");
assertEq("switch active lane", switched.activeLane, "video");
assertEq(
  "image draft preserved after switch",
  switched.lanes.image.aspectRatio,
  "16:9",
);

const roundTrip = switchActiveLane(switchActiveLane(switched, "image"), "image");
assertEq(
  "round-trip image aspect",
  roundTrip.lanes.image.aspectRatio,
  "16:9",
);
assertEq(
  "round-trip image model",
  roundTrip.lanes.image.modelId,
  "seedream-5",
);

const failed = results.filter((r) => !r.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} test(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${results.length} creation-lane-drafts tests passed.`);
