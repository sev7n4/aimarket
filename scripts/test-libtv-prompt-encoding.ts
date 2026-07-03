/**
 * LIBTV 缺口：灯光/摄像机 prompt 编码单测
 * pnpm exec tsx scripts/test-libtv-prompt-encoding.ts
 */
import { encodeLightingPrompt } from "../apps/api/src/lib/lighting-prompt.js";
import { encodeCameraPrompt } from "../apps/api/src/lib/camera-prompt.js";
import { applyCameraPreset } from "../apps/api/src/lib/camera-presets.js";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

const lighting = encodeLightingPrompt([
  {
    id: "l1",
    x: 0.1,
    y: 0.2,
    colorTemp: "warm-yellow",
    intensity: 0.9,
    lightType: "spot",
  },
]);
ok(
  "encodeLightingPrompt 含色温与强度",
  lighting.includes("暖黄") && lighting.includes("强烈照射"),
);

const camera = encodeCameraPrompt({
  tilt: -25,
  pan: 0,
  fov: "close-up",
});
ok(
  "encodeCameraPrompt 含仰拍与特写",
  camera.includes("仰拍") && camera.includes("特写"),
);

const preset = applyCameraPreset("orbit", "产品展示视频");
ok(
  "applyCameraPreset 附加运镜后缀",
  preset.includes("环绕") && preset.startsWith("产品展示视频"),
);

const missing = applyCameraPreset("unknown-id", "原始 prompt");
ok("applyCameraPreset 未知 ID 原样返回", missing === "原始 prompt");

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error(`\n${failed.length} failed`);
  process.exit(1);
}
console.log(`\nAll ${results.length} tests passed.`);
