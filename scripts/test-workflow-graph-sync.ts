#!/usr/bin/env node
/**
 * workflow-graph-sync 单测
 * pnpm --filter @aimarket/api exec sh -c 'TSX_TSCONFIG_PATH=../web/tsconfig.json tsx ../../scripts/test-workflow-graph-sync.ts'
 */
import { CanvasNodeType } from "../apps/web/src/components/infinite-canvas/types.ts";
import type { CanvasConnection, CanvasNodeData } from "../apps/web/src/components/infinite-canvas/types.ts";
import {
  buildWorkflowConnectionSyncOps,
  buildWorkflowNodeKey,
  injectWorkflowConnectedUrls,
  resolveNodeOutputUrl,
} from "../apps/web/src/lib/workflow-graph-sync.ts";

const results: { name: string; pass: boolean }[] = [];
function assert(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

const imageNode: CanvasNodeData = {
  id: "img-1",
  type: CanvasNodeType.Image,
  title: "参考图",
  position: { x: 0, y: 0 },
  width: 280,
  height: 280,
  metadata: { content: "https://cdn.example.com/a.png", status: "success" },
};

const videoTarget: CanvasNodeData = {
  id: "wf-video-1",
  type: CanvasNodeType.Video,
  title: "图生视频",
  position: { x: 400, y: 0 },
  width: 420,
  height: 236,
  metadata: {
    status: "idle",
    workflowToolType: "IMAGE_TO_VIDEO",
    generationMode: "video",
  },
};

const edge: CanvasConnection = {
  id: "e1",
  fromNodeId: "img-1",
  toNodeId: "wf-video-1",
};

assert("resolveNodeOutputUrl", resolveNodeOutputUrl(imageNode) === "https://cdn.example.com/a.png");
assert(
  "inject connectedImageUrls",
  injectWorkflowConnectedUrls([imageNode, videoTarget], [edge])[1].metadata
    ?.connectedImageUrls?.[0] === "https://cdn.example.com/a.png",
);
assert(
  "buildWorkflowConnectionSyncOps emits patch",
  buildWorkflowConnectionSyncOps([imageNode, videoTarget], [edge]).length === 1,
);
assert(
  "buildWorkflowNodeKey",
  buildWorkflowNodeKey("sess-1", "node-1") === "sess-1:node-1",
);

const failed = results.filter((r) => !r.pass).length;
if (failed > 0) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log(`\n${results.length} passed`);
