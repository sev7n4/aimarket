#!/usr/bin/env node
/**
 * workflow 模板反序列化单测
 * pnpm --filter @aimarket/api exec sh -c 'TSX_TSCONFIG_PATH=../web/tsconfig.json tsx ../../scripts/test-workflow-template-apply.ts'
 */
import { CanvasNodeType } from "../apps/web/src/components/infinite-canvas/types.ts";
import {
  serializeWorkflowSelection,
  workflowTemplateToOps,
} from "../apps/web/src/lib/workflow-template-apply.ts";

const results: { name: string; pass: boolean }[] = [];

function assert(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

const payload = serializeWorkflowSelection(
  [
    {
      id: "a",
      type: CanvasNodeType.Image,
      title: "文生图",
      position: { x: 100, y: 200 },
      width: 320,
      height: 320,
      metadata: { workflowToolType: "TEXT_TO_IMAGE" },
    },
    {
      id: "b",
      type: CanvasNodeType.Video,
      title: "图生视频",
      position: { x: 500, y: 200 },
      width: 320,
      height: 180,
      metadata: { workflowToolType: "IMAGE_TO_VIDEO" },
    },
  ],
  [{ fromNodeId: "a", toNodeId: "b" }],
);

assert("serialize kind", payload.kind === "workflow");
assert("serialize 2 nodes", payload.nodes.length === 2);
assert("serialize rel position", payload.nodes[1]?.relX === 400);
assert("serialize connection", payload.connections[0]?.toNodeIndex === 1);

const ops = workflowTemplateToOps(payload, "sess-1", { x: 0, y: 0 });
assert("ops add + connect", ops.length === 3);
assert(
  "nodeKey set",
  ops[0]?.type === "add_node" &&
    Boolean((ops[0] as { metadata?: { workflowNodeKey?: string } }).metadata?.workflowNodeKey?.startsWith("sess-1:")),
);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
