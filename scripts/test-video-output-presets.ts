#!/usr/bin/env node
/**
 * 视频输出预设单测
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-video-output-presets.ts
 */
import {
  coerceVideoAspectRatio,
  coerceVideoDuration,
  coerceVideoResolution,
  getVideoOutputPreset,
} from "../apps/api/src/lib/video-output-presets.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

const omni = getVideoOutputPreset("omni");
ok("omni 默认 4s", omni.defaultDuration === 4);
ok("omni 含 720P/1080P", omni.resolutions.length === 2);

const smart = getVideoOutputPreset("smart-multi-frame");
ok("智能多帧固定 16:9", smart.aspectRatios[0] === "16:9");
ok("智能多帧固定 720P", smart.defaultResolution === "720P");

ok(
  "智能多帧时长推算",
  coerceVideoDuration("smart-multi-frame", undefined, 3) === 10,
);

ok(
  "首尾帧 coerce 画幅",
  coerceVideoAspectRatio("first-last", "21:9") === "16:9",
);

ok(
  "全能 coerce 分辨率",
  coerceVideoResolution("omni", undefined) === "1080P",
);

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} 通过\n`);
process.exit(failed > 0 ? 1 : 0);
