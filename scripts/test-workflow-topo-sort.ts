#!/usr/bin/env node
/**
 * workflow-topo-sort 单测
 * pnpm --filter @aimarket/api exec sh -c 'TSX_TSCONFIG_PATH=../web/tsconfig.json tsx ../../scripts/test-workflow-topo-sort.ts'
 */
import { CanvasNodeType } from "../apps/web/src/components/infinite-canvas/types.ts";
import type { CanvasConnection, CanvasNodeData } from "../apps/web/src/components/infinite-canvas/types.ts";
import { topoSortWorkflowNodes } from "../apps/web/src/lib/workflow-topo-sort.ts";

const results: { name: string; pass: boolean }[] = [];
function assert(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

function node(id: string): CanvasNodeData {
  return {
    id,
    type: CanvasNodeType.Text,
    title: id,
    position: { x: 0, y: 0 },
    width: 200,
    height: 80,
  };
}

function edge(fromNodeId: string, toNodeId: string): CanvasConnection {
  return { id: `${fromNodeId}->${toNodeId}`, fromNodeId, toNodeId };
}

function indexOf(order: string[], id: string): number {
  const i = order.indexOf(id);
  if (i < 0) throw new Error(`missing node ${id}`);
  return i;
}

// 线性 A → B → C
{
  const nodes = [node("A"), node("B"), node("C")];
  const edges = [edge("A", "B"), edge("B", "C")];
  const { order, cycle } = topoSortWorkflowNodes(nodes, edges);
  assert("linear: no cycle", !cycle);
  assert("linear: order A→B→C", order.join("→") === "A→B→C");
}

// 菱形 A → B → D, A → C → D
{
  const nodes = [node("A"), node("B"), node("C"), node("D")];
  const edges = [edge("A", "B"), edge("A", "C"), edge("B", "D"), edge("C", "D")];
  const { order, cycle } = topoSortWorkflowNodes(nodes, edges);
  assert("diamond: no cycle", !cycle);
  assert("diamond: A before B/C", indexOf(order, "A") < indexOf(order, "B") && indexOf(order, "A") < indexOf(order, "C"));
  assert("diamond: B/C before D", indexOf(order, "B") < indexOf(order, "D") && indexOf(order, "C") < indexOf(order, "D"));
  assert("diamond: all nodes present", order.length === 4);
}

// 有环 A → B → C → A
{
  const nodes = [node("A"), node("B"), node("C")];
  const edges = [edge("A", "B"), edge("B", "C"), edge("C", "A")];
  const { order, cycle } = topoSortWorkflowNodes(nodes, edges);
  assert("cycle: detected", cycle);
  assert("cycle: partial order", order.length < nodes.length);
}

const failed = results.filter((r) => !r.pass).length;
if (failed > 0) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log(`\n${results.length} passed`);
