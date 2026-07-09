#!/usr/bin/env node
/**
 * Agent 占位节点 Job 产出绑定单测
 * pnpm exec tsx scripts/test-agent-placeholder-bind.ts
 */
import {
  bindAgentPlaceholderOutputs,
  isAgentPlaceholderItem,
} from "../apps/web/src/lib/agent-placeholder-bind.ts";
import type { CanvasItem } from "../apps/web/src/lib/canvas-tools.ts";

const results: { name: string; pass: boolean }[] = [];

function assert(name: string, condition: boolean, detail?: string) {
  results.push({ name, pass: condition });
  console.log(`${condition ? "✓" : "✗"} ${name}${condition ? "" : detail ? ` — ${detail}` : ""}`);
}

const placeholder: CanvasItem = {
  id: "image-agent-1",
  url: "",
  x: 120,
  y: 240,
  width: 320,
  height: 240,
  isVideo: false,
  label: "产品主图",
  infiniteNodeMeta: { status: "loading", prompt: "白底产品图" },
};

const output: CanvasItem = {
  id: "out-job-99",
  url: "https://cdn.example.com/a.png",
  outputId: "uuid-out-1",
  x: 0,
  y: 900,
  width: 320,
  height: 240,
  isVideo: false,
  batchId: "job-99",
  batchIndex: 3,
  source: "generation",
  role: "output",
  sourceItemId: "image-agent-1",
};

assert("detects placeholder", isAgentPlaceholderItem(placeholder));
assert("output is not placeholder", !isAgentPlaceholderItem(output));

const bound = bindAgentPlaceholderOutputs([placeholder, output]);
assert("merges into single item", bound.length === 1, `len=${bound.length}`);
const merged = bound[0];
assert(
  "keeps placeholder id and position",
  merged?.id === "image-agent-1" && merged.x === 120 && merged.y === 240,
);
assert("fills output url", merged?.url === output.url);
assert("clears sourceItemId", merged?.sourceItemId === undefined);
assert("marks success", merged?.infiniteNodeMeta?.status === "success");

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
