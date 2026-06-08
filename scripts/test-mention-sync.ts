#!/usr/bin/env node
/**
 * @ 引用与 prompt 同步单测（纯逻辑）
 * pnpm exec tsx scripts/test-mention-sync.ts
 */
import {
  extractMentionLabelsFromPrompt,
  filterAssetIdsByPromptLabels,
  filterRefsByPromptLabels,
  removeMentionTokenFromPrompt,
} from "../apps/web/src/lib/mention-sync.ts";

const results: { name: string; pass: boolean; detail?: string }[] = [];

function ok(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
  const icon = pass ? "✓" : "✗";
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`);
}

function assertEq<T>(name: string, actual: T, expected: T) {
  ok(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    JSON.stringify(actual) !== JSON.stringify(expected)
      ? `got ${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`
      : "",
  );
}

assertEq(
  "extract labels",
  extractMentionLabelsFromPrompt("改一下 @图1 和 @图2 的风格"),
  ["图1", "图2"],
);

assertEq(
  "extract dedupe",
  extractMentionLabelsFromPrompt("@图1 @图1"),
  ["图1"],
);

assertEq(
  "remove token",
  removeMentionTokenFromPrompt("请把 @图1 变亮", "图1"),
  "请把 变亮",
);

assertEq(
  "remove multiple",
  removeMentionTokenFromPrompt("@图1 @图2 合成", "图1"),
  "@图2 合成",
);

const refs = [
  { id: "out-1", label: "图1" },
  { id: "out-2", label: "图2" },
];
assertEq(
  "filter refs by labels",
  filterRefsByPromptLabels(refs, ["图2"]),
  [{ id: "out-2", label: "图2" }],
);

const labelMap = new Map([
  ["a1", "图1"],
  ["a2", "上传图1"],
]);
assertEq(
  "filter assets by labels",
  filterAssetIdsByPromptLabels(["a1", "a2"], labelMap, ["上传图1"]),
  ["a2"],
);

const failed = results.filter((r) => !r.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} test(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${results.length} mention-sync tests passed.`);
