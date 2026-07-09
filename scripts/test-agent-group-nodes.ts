#!/usr/bin/env node
/**
 * Agent group_nodes Op 单测
 * pnpm exec tsx scripts/test-agent-group-nodes.ts
 */
import { CanvasNodeType } from "../apps/web/src/components/infinite-canvas/types.ts";
import { applyCanvasAgentOps, type CanvasAgentSnapshot } from "../apps/web/src/components/infinite-canvas/utils.ts";
import { onlineToolToOps } from "../apps/web/src/components/infinite-canvas/agent/agent-tools.ts";

const results: { name: string; pass: boolean }[] = [];

function assert(name: string, condition: boolean, detail?: string) {
  results.push({ name, pass: condition });
  console.log(`${condition ? "✓" : "✗"} ${name}${condition ? "" : detail ? ` — ${detail}` : ""}`);
}

const baseSnapshot: CanvasAgentSnapshot = {
  projectId: "p1",
  title: "test",
  nodes: [
    {
      id: "n1",
      type: CanvasNodeType.Image,
      title: "A",
      position: { x: 100, y: 200 },
      width: 240,
      height: 180,
    },
    {
      id: "n2",
      type: CanvasNodeType.Text,
      title: "B",
      position: { x: 500, y: 350 },
      width: 200,
      height: 120,
    },
    {
      id: "n3",
      type: CanvasNodeType.Video,
      title: "C",
      position: { x: 80, y: 600 },
      width: 320,
      height: 200,
    },
  ],
  connections: [],
  selectedNodeIds: [],
  viewport: { x: 0, y: 0, k: 1 },
};

const grouped = applyCanvasAgentOps(baseSnapshot, [
  { type: "group_nodes", ids: ["n1", "n2", "n3"], title: "产品素材", columns: 2, gap: 40 },
]);

const groupIds = new Set(
  grouped.nodes.filter((n) => n.metadata?.agentGroupId && !n.metadata?.isAgentGroupLabel).map((n) => n.metadata!.agentGroupId),
);
assert("all members share agentGroupId", groupIds.size === 1, `got ${groupIds.size}`);
assert(
  "members repositioned to grid",
  grouped.nodes.find((n) => n.id === "n1")?.position.x === 80 &&
    grouped.nodes.find((n) => n.id === "n2")?.position.x === 80 + 320 + 40 &&
    grouped.nodes.find((n) => n.id === "n3")?.position.y === 200 + 200 + 40,
);
const label = grouped.nodes.find((n) => n.metadata?.isAgentGroupLabel);
assert("creates label node when title provided", Boolean(label) && label?.metadata?.content === "产品素材");
assert("selects grouped nodes and label", grouped.selectedNodeIds.length === 4);

const toolOps = onlineToolToOps(
  "canvas_group_nodes",
  { ids: ["n1", "missing", "n2"], title: "批次" },
  baseSnapshot,
);
assert("canvas_group_nodes filters missing ids", toolOps.length === 1 && toolOps[0]?.type === "group_nodes");
if (toolOps[0]?.type === "group_nodes") {
  assert("canvas_group_nodes keeps existing ids", toolOps[0].ids.length === 2 && toolOps[0].ids.includes("n1"));
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
