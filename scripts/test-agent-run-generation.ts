#!/usr/bin/env node
/**
 * Agent run_generation 绑定与收集逻辑单测
 * pnpm exec tsx scripts/test-agent-run-generation.ts
 */
import { CanvasNodeType } from "../apps/web/src/components/infinite-canvas/types.ts";
import {
  bindRunGenerationNodeIds,
  collectRunGenerationRequests,
  resolveAgentGenerationMode,
} from "../apps/web/src/lib/agent-run-generation.ts";
import type { CanvasAgentOp } from "../apps/web/src/components/infinite-canvas/utils.ts";

const results: { name: string; pass: boolean }[] = [];

function assertEq<T>(name: string, actual: T, expected: T) {
  const pass = actual === expected;
  results.push({ name, pass });
  console.log(
    `${pass ? "✓" : "✗"} ${name}${pass ? "" : ` — got ${String(actual)}, want ${String(expected)}`}`,
  );
}

function assert(name: string, condition: boolean, detail?: string) {
  results.push({ name, pass: condition });
  console.log(`${condition ? "✓" : "✗"} ${name}${condition ? "" : detail ? ` — ${detail}` : ""}`);
}

const bound = bindRunGenerationNodeIds([
  { type: "add_node", nodeType: CanvasNodeType.Image, title: "图", x: 0, y: 0 },
  { type: "run_generation", nodeId: "", mode: "image", prompt: "test" },
] as CanvasAgentOp[]);

const addOp = bound[0];
const runOp = bound[1];
assert(
  "bind assigns nodeId",
  addOp?.type === "add_node" &&
    runOp?.type === "run_generation" &&
    runOp.nodeId === (addOp as { id?: string }).id &&
    Boolean((addOp as { id?: string }).id),
);

const nodeId = "image-test-1";
const nodes = [
  {
    id: nodeId,
    type: CanvasNodeType.Image,
    title: "图",
    position: { x: 0, y: 0 },
    width: 320,
    height: 320,
    metadata: { status: "loading" as const, prompt: "hello" },
  },
];
const requests = collectRunGenerationRequests(nodes, [
  { type: "run_generation", nodeId, mode: "image", prompt: "hello" },
]);
assertEq("collect one request", requests.length, 1);
assertEq("collect prompt", requests[0]?.prompt, "hello");

assertEq(
  "resolve video from node type",
  resolveAgentGenerationMode({
    id: "v1",
    type: CanvasNodeType.Video,
    title: "v",
    position: { x: 0, y: 0 },
    width: 320,
    height: 180,
    metadata: {},
  }),
  "video",
);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
