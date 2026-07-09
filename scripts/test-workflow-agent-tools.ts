#!/usr/bin/env node
/**
 * 工作流 Agent 工具 schema + onlineToolToOps 单测
 * pnpm --filter @aimarket/api exec sh -c 'TSX_TSCONFIG_PATH=../web/tsconfig.json tsx ../../scripts/test-workflow-agent-tools.ts'
 */
import { CanvasNodeType } from "../apps/web/src/components/infinite-canvas/types.ts";
import {
  WORKFLOW_AGENT_TOOLS,
  getAgentToolsForContext,
  onlineToolToOps,
  resolveWorkflowReadOnlyTool,
} from "../apps/web/src/components/infinite-canvas/agent/agent-tools.ts";
import type { CanvasAgentSnapshot } from "../apps/web/src/components/infinite-canvas/utils.ts";

const results: { name: string; pass: boolean }[] = [];

function assert(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

const snapshot: CanvasAgentSnapshot = {
  projectId: "sess-test",
  title: "test",
  nodes: [
    {
      id: "wf-node-1",
      type: CanvasNodeType.Image,
      title: "文生图",
      position: { x: 0, y: 0 },
      width: 320,
      height: 320,
      metadata: {
        workflowToolType: "TEXT_TO_IMAGE",
        status: "idle",
        workflowNodeKey: "sess-test:wf-node-1",
      },
    },
    {
      id: "img-src",
      type: CanvasNodeType.Image,
      title: "参考图",
      position: { x: -200, y: 0 },
      width: 200,
      height: 200,
      metadata: { content: "https://example.com/ref.png" },
    },
  ],
  connections: [],
  selectedNodeIds: [],
  viewport: { x: 0, y: 0, k: 1 },
};

assert("workflow tools count", WORKFLOW_AGENT_TOOLS.length === 5);
assert(
  "workflow shell tools include workflow_add_tool_node",
  getAgentToolsForContext({ workflowShell: true }).some((t) => t.name === "workflow_add_tool_node"),
);
assert(
  "studio tools exclude workflow_add_tool_node",
  !getAgentToolsForContext({ workflowShell: false }).some((t) => t.name === "workflow_add_tool_node"),
);

const addOps = onlineToolToOps(
  "workflow_add_tool_node",
  { toolType: "TEXT_TO_IMAGE", x: 100, y: 200, prompt: "产品主图" },
  snapshot,
);
assert("add tool node op", addOps[0]?.type === "add_node");
assert(
  "add tool node metadata",
  addOps[0]?.type === "add_node" && addOps[0].metadata?.workflowToolType === "TEXT_TO_IMAGE",
);

const connectOps = onlineToolToOps(
  "workflow_connect_nodes",
  { fromNodeId: "img-src", toNodeId: "wf-node-1" },
  snapshot,
);
assert("connect nodes op", connectOps[0]?.type === "connect_nodes");

const runOps = onlineToolToOps(
  "workflow_run_node",
  { nodeId: "wf-node-1", prompt: "跑一下" },
  snapshot,
);
assert("run workflow has update + external", runOps.length === 2);
assert(
  "run workflow external op",
  runOps.some((op) => op.type === "run_workflow_node"),
);

const listResult = resolveWorkflowReadOnlyTool("workflow_list_tools", {}, snapshot);
assert("list tools readonly", Boolean(listResult?.data?.tools));

const statusResult = resolveWorkflowReadOnlyTool(
  "workflow_query_status",
  { nodeIds: ["wf-node-1"] },
  snapshot,
);
assert(
  "query status readonly",
  statusResult?.data?.statuses != null &&
    (statusResult.data.statuses as Record<string, { status?: string }>)["wf-node-1"]?.status ===
      "idle",
);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
