#!/usr/bin/env node
/**
 * Infinite 节点工具链去重单测（纯逻辑，无需 API）
 * pnpm --filter @aimarket/api exec sh -c 'TSX_TSCONFIG_PATH=../web/tsconfig.json tsx ../../scripts/test-infinite-node-toolbar-actions.ts'
 */
import { buildInfiniteNodeToolbarActions } from "../apps/web/src/components/infinite-canvas/infinite-node-toolbar-actions.ts";
import {
  CanvasNodeType,
  type CanvasNodeData,
} from "../apps/web/src/components/infinite-canvas/types.ts";
import type { CanvasItem } from "../apps/web/src/lib/canvas-tools.ts";
import type { StudioTool } from "../apps/web/src/lib/types.ts";

const results: { name: string; pass: boolean; detail?: string }[] = [];

function assert(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function imageNode(): CanvasNodeData {
  return {
    id: "img-1",
    type: CanvasNodeType.Image,
    title: "test",
    position: { x: 0, y: 0 },
    width: 200,
    height: 200,
    metadata: { content: "https://example.com/a.png" },
  };
}

const stubHandlers = {
  onCutout: () => {},
  onExpand: () => {},
  onRerun: () => {},
  onDownload: () => {},
  onDelete: () => {},
};

const studioTools: StudioTool[] = [
  {
    id: "cutout",
    name: "抠图",
    description: "",
    defaultPrompt: "",
  },
  {
    id: "expand",
    name: "扩图",
    description: "",
    defaultPrompt: "",
  },
  {
    id: "variation",
    name: "变体",
    description: "",
    defaultPrompt: "",
  },
];

const canvasItem: CanvasItem = {
  id: "img-1",
  url: "https://example.com/a.png",
  width: 200,
  height: 200,
  x: 0,
  y: 0,
  outputId: "out-1",
};

// 无 Studio 工具时：仅 menu actions
{
  const actions = buildInfiniteNodeToolbarActions({
    node: imageNode(),
    handlers: stubHandlers,
  });
  assert(
    "no item -> menu only, includes cutout menu id",
    actions.some((a) => a.id === "infinite-node-tool-cutout"),
  );
  assert(
    "no item -> no studio batch ids",
    !actions.some((a) => a.id.startsWith("canvas-batch-tool-")),
  );
}

// 有 Studio 工具时：cutout/expand 去重，variation 保留
{
  const actions = buildInfiniteNodeToolbarActions({
    node: imageNode(),
    handlers: stubHandlers,
    item: canvasItem,
    tools: studioTools,
    onRunTool: () => {},
  });
  const ids = actions.map((a) => a.id);
  assert(
    "studio cutout present",
    ids.includes("canvas-batch-tool-cutout"),
  );
  assert(
    "menu cutout deduped",
    !ids.includes("infinite-node-tool-cutout"),
  );
  assert(
    "menu expand deduped",
    !ids.includes("infinite-node-tool-expand"),
  );
  assert(
    "studio-only variation kept",
    ids.includes("canvas-batch-tool-variation"),
  );
  assert(
    "menu rerun kept (no studio overlap)",
    ids.includes("infinite-node-tool-rerun"),
  );
  assert(
    "studio actions before menu actions",
    ids.indexOf("canvas-batch-tool-cutout") <
      ids.indexOf("infinite-node-tool-rerun"),
  );
}

// pending 态传递到 studio action
{
  const actions = buildInfiniteNodeToolbarActions({
    node: imageNode(),
    handlers: stubHandlers,
    item: canvasItem,
    tools: studioTools,
    pendingToolId: "cutout",
    onRunTool: () => {},
  });
  const cutout = actions.find((a) => a.id === "canvas-batch-tool-cutout");
  assert(
    "pending cutout spinning",
    Boolean(cutout?.spinning),
  );
}

// Text 节点：无 canvas item，仅 menu/basic
{
  const textNode: CanvasNodeData = {
    ...imageNode(),
    id: "text-1",
    type: CanvasNodeType.Text,
  };
  const actions = buildInfiniteNodeToolbarActions({
    node: textNode,
    handlers: { onDelete: () => {} },
    item: null,
    tools: studioTools,
    onRunTool: () => {},
  });
  assert(
    "text node -> delete in toolbar",
    actions.some((a) => a.id === "infinite-node-tool-delete"),
  );
}

const failed = results.filter((r) => !r.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} test(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${results.length} infinite-node-toolbar-actions tests passed.`);
