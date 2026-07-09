#!/usr/bin/env node
/**
 * 工作流工具节点注册表单测
 * pnpm exec tsx scripts/test-workflow-tool-registry.ts
 */
import {
  WORKFLOW_TOOL_IDS,
  buildWorkflowToolNodeOp,
  getWorkflowTool,
  isWorkflowToolId,
  listWorkflowTools,
  listWorkflowToolsByCategory,
} from "../apps/web/src/lib/workflow-tool-registry.ts";

const results: { name: string; pass: boolean }[] = [];

function assert(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

assert("lists all tools", listWorkflowTools().length === WORKFLOW_TOOL_IDS.length);
assert(
  "groups cover all tools",
  listWorkflowToolsByCategory().reduce((sum, g) => sum + g.tools.length, 0) ===
    WORKFLOW_TOOL_IDS.length,
);
assert("TEXT_TO_IMAGE exists", Boolean(getWorkflowTool("TEXT_TO_IMAGE")));
assert(
  "isWorkflowToolId guards unknown",
  !isWorkflowToolId("NOT_A_TOOL") && isWorkflowToolId("TEXT_TO_VIDEO"),
);

const op = buildWorkflowToolNodeOp(getWorkflowTool("TEXT_TO_IMAGE")!, 100, 200);
assert("op is add_node", op.type === "add_node");
assert(
  "op carries workflowToolType",
  op.type === "add_node" &&
    op.metadata?.workflowToolType === "TEXT_TO_IMAGE" &&
    op.metadata?.generationMode === "image",
);

const failed = results.filter((r) => !r.pass).length;
if (failed > 0) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log(`\n${results.length} passed`);
