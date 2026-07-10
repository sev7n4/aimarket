/**
 * workflow canvas item → node 映射单测
 * pnpm --filter @aimarket/api exec sh -c 'TSX_TSCONFIG_PATH=../web/tsconfig.json tsx ../../scripts/test-canvas-item-workflow-node.ts'
 */
import { canvasItemToNodeData } from "../apps/web/src/components/infinite-canvas/migration.ts";
import { CanvasNodeType } from "../apps/web/src/components/infinite-canvas/types";

const results: { name: string; pass: boolean }[] = [];
function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

const node = canvasItemToNodeData({
  id: "wf-text_to_image-abc",
  url: "",
  x: 100,
  y: 200,
  width: 280,
  height: 200,
  label: "文生图",
  infiniteNodeType: "workflow",
  infiniteNodeMeta: {
    workflowToolType: "TEXT_TO_IMAGE",
    workflowNodeKey: "sess:wf-text_to_image-abc",
    generationMode: "image",
    prompt: "test",
  },
});

ok("workflow node type image", node.type === CanvasNodeType.Image);
ok(
  "workflowToolType preserved",
  node.metadata?.workflowToolType === "TEXT_TO_IMAGE",
);
ok(
  "workflowNodeKey preserved",
  node.metadata?.workflowNodeKey === "sess:wf-text_to_image-abc",
);

const errorNode = canvasItemToNodeData({
  id: "wf-outpaint-err",
  url: "",
  x: 0,
  y: 0,
  width: 280,
  height: 200,
  label: "扩图",
  infiniteNodeType: "workflow",
  infiniteNodeMeta: {
    workflowToolType: "IMAGE_OUTPAINTING",
    generationMode: "image",
    status: "error",
    errorDetails: "请先连接上游图片节点",
  },
});
ok("error status preserved", errorNode.metadata?.status === "error");
ok(
  "errorDetails preserved",
  errorNode.metadata?.errorDetails === "请先连接上游图片节点",
);

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error("\nFailed:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
console.log(`\n${results.length} passed`);
