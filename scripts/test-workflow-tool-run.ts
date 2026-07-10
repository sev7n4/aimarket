/**
 * workflow 工具 run 端点路由单测
 * pnpm --filter @aimarket/api exec sh -c 'TSX_TSCONFIG_PATH=../web/tsconfig.json tsx ../../scripts/test-workflow-tool-run.ts'
 */
import { CanvasNodeType } from "../apps/web/src/components/infinite-canvas/types";
import {
  resolveWorkflowRunEndpoint,
  workflowRunRequiresReference,
  workflowRunRequiresLipSyncSources,
} from "../apps/web/src/lib/workflow-tool-run.ts";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

ok(
  "TEXT_TO_IMAGE → generate-image",
  resolveWorkflowRunEndpoint({
    workflowToolType: "TEXT_TO_IMAGE",
    nodeType: CanvasNodeType.Image,
  }) === "generate-image",
);
ok(
  "IMAGE_TO_VIDEO → generate-video",
  resolveWorkflowRunEndpoint({
    workflowToolType: "IMAGE_TO_VIDEO",
    nodeType: CanvasNodeType.Video,
  }) === "generate-video",
);
ok(
  "IMAGE_OUTPAINTING → outpainting",
  resolveWorkflowRunEndpoint({
    workflowToolType: "IMAGE_OUTPAINTING",
    nodeType: CanvasNodeType.Image,
  }) === "outpainting",
);
ok(
  "IMAGE_UPSCALE → upscale-image",
  resolveWorkflowRunEndpoint({
    workflowToolType: "IMAGE_UPSCALE",
    nodeType: CanvasNodeType.Image,
  }) === "upscale-image",
);
ok(
  "LIGHTING_MODIFICATION → lighting",
  resolveWorkflowRunEndpoint({
    workflowToolType: "LIGHTING_MODIFICATION",
    nodeType: CanvasNodeType.Image,
  }) === "lighting",
);
ok(
  "MUSIC_GENERATION → generate-music",
  resolveWorkflowRunEndpoint({
    workflowToolType: "MUSIC_GENERATION",
    nodeType: CanvasNodeType.Audio,
  }) === "generate-music",
);
ok(
  "AUDIO_GENERATION → generate-audio",
  resolveWorkflowRunEndpoint({
    workflowToolType: "AUDIO_GENERATION",
    nodeType: CanvasNodeType.Audio,
  }) === "generate-audio",
);
ok(
  "LIP_SYNC → lip-sync",
  resolveWorkflowRunEndpoint({
    workflowToolType: "LIP_SYNC",
    nodeType: CanvasNodeType.Video,
  }) === "lip-sync",
);
ok(
  "POSE_REFERENCE → pose-reference",
  resolveWorkflowRunEndpoint({
    workflowToolType: "POSE_REFERENCE",
    nodeType: CanvasNodeType.Image,
  }) === "pose-reference",
);
ok(
  "MOTION_CONTROL → motion-control",
  resolveWorkflowRunEndpoint({
    workflowToolType: "MOTION_CONTROL",
    nodeType: CanvasNodeType.Video,
  }) === "motion-control",
);
ok(
  "video node fallback",
  resolveWorkflowRunEndpoint({
    nodeType: CanvasNodeType.Video,
  }) === "generate-video",
);
ok(
  "outpainting requires reference",
  workflowRunRequiresReference("IMAGE_OUTPAINTING"),
);
ok(
  "text to image no reference required",
  !workflowRunRequiresReference("TEXT_TO_IMAGE"),
);
ok(
  "pose reference requires reference",
  workflowRunRequiresReference("POSE_REFERENCE"),
);
ok(
  "lip sync requires video+audio sources",
  workflowRunRequiresLipSyncSources("LIP_SYNC"),
);

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error("\nFailed:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
console.log(`\n${results.length} passed`);
