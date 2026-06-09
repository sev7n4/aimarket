#!/usr/bin/env node
/**
 * 视频 Auto 模型解析单测
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-video-auto-model.ts
 */
import {
  resolveVideoSubmitModelId,
  videoAutoPickerLabel,
} from "../apps/web/src/lib/video-auto-model.ts";
import { AUTO_MODEL_ID } from "../apps/web/src/lib/creation-lane-drafts.ts";
import { resolveDefaultVideoModelId } from "../apps/api/src/providers/video/registry.ts";

const models = [
  { id: "seedance-2", name: "Seedance 2", type: "video" as const },
  { id: "agnes-video", name: "Agnes Video 2.0", type: "video" as const },
];

const results: { name: string; pass: boolean; detail?: string }[] = [];

function ok(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const videoAuto = {
  modelId: "agnes-video",
  provider: "agnes-video",
  modelName: "Agnes Video 2.0",
};

ok(
  "resolveVideoSubmitModelId auto -> meta",
  resolveVideoSubmitModelId(AUTO_MODEL_ID, models, videoAuto) === "agnes-video",
);

ok(
  "resolveVideoSubmitModelId explicit",
  resolveVideoSubmitModelId("seedance-2", models, videoAuto) === "seedance-2",
);

ok(
  "videoAutoPickerLabel",
  videoAutoPickerLabel(AUTO_MODEL_ID, models, videoAuto) === "Agnes Video 2.0",
);

ok(
  "resolveDefaultVideoModelId returns known id",
  ["seedance-2", "agnes-video"].includes(resolveDefaultVideoModelId()),
  resolveDefaultVideoModelId(),
);

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} 通过\n`);
process.exit(failed > 0 ? 1 : 0);
