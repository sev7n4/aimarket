#!/usr/bin/env node
/**
 * Infinite 节点 menu handler 工厂单测（纯逻辑，无需 API）
 * pnpm --filter @aimarket/api exec sh -c 'TSX_TSCONFIG_PATH=../web/tsconfig.json tsx ../../scripts/test-infinite-node-menu-handlers.ts'
 */
import {
  buildInfiniteNodeMenuHandlers,
  type InfiniteNodeMenuHandlerContext,
} from "../apps/web/src/hooks/use-infinite-node-menu-handlers.ts";
import {
  CanvasNodeType,
  type CanvasNodeData,
} from "../apps/web/src/components/infinite-canvas/types.ts";
import type { CanvasItem } from "../apps/web/src/lib/canvas-tools.ts";

const results: { name: string; pass: boolean; detail?: string }[] = [];

function assert(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function imageNode(id = "img-1"): CanvasNodeData {
  return {
    id,
    type: CanvasNodeType.Image,
    title: "test",
    position: { x: 0, y: 0 },
    width: 200,
    height: 200,
    metadata: { content: "https://example.com/a.png" },
  };
}

const canvasItem: CanvasItem = {
  id: "img-1",
  url: "https://example.com/a.png",
  width: 200,
  height: 200,
  x: 0,
  y: 0,
  outputId: "out-1",
};

function baseCtx(
  overrides: Partial<InfiniteNodeMenuHandlerContext> = {},
): InfiniteNodeMenuHandlerContext {
  return {
    items: [canvasItem],
    onDeleteNodes: () => {},
    onSelect: () => {},
    onOpenLightbox: () => {},
    onVideoInpaint: () => {},
    onOpenLighting: () => {},
    onOpenCamera: () => {},
    onMusicGen: () => {},
    onRunInfiniteNodeTool: () => {},
    onEditDramaNode: () => {},
    ...overrides,
  };
}

// cutout/expand/rerun 需 item + 回调
{
  const handlers = buildInfiniteNodeMenuHandlers(imageNode(), baseCtx());
  assert("no callbacks -> cutout undefined", handlers.onCutout === undefined);
  assert("no callbacks -> expand undefined", handlers.onExpand === undefined);
  assert("no callbacks -> rerun undefined", handlers.onRerun === undefined);

  let cutoutItem: CanvasItem | null = null;
  const withCutout = buildInfiniteNodeMenuHandlers(
    imageNode(),
    baseCtx({ onCutoutItem: (item) => { cutoutItem = item; } }),
  );
  withCutout.onCutout?.();
  assert("cutout passes canvas item", cutoutItem?.id === "img-1");
}

// delete 始终可用
{
  let deleted: string[] = [];
  const handlers = buildInfiniteNodeMenuHandlers(
    imageNode("del-1"),
    baseCtx({ onDeleteNodes: (ids) => { deleted = ids; } }),
  );
  handlers.onDelete?.();
  assert("delete passes node id", deleted.join(",") === "del-1");
}

// multi-cam 工具链非 stub
{
  const calls: { toolId: string; nodeId: string }[] = [];
  const handlers = buildInfiniteNodeMenuHandlers(
    imageNode(),
    baseCtx({
      onRunInfiniteNodeTool: (toolId, node) => {
        calls.push({ toolId, nodeId: node.id });
      },
    }),
  );
  handlers.onMultiCam9?.();
  handlers.onStoryboardEvolve?.();
  assert(
    "multi-cam-9 routed",
    calls.some((c) => c.toolId === "multi-cam-9" && c.nodeId === "img-1"),
  );
  assert(
    "storyboard-evolve routed",
    calls.some((c) => c.toolId === "storyboard-evolve"),
  );
}

// download：有 item 走 onDownloadItem，无 item 走 openAssetUrl
{
  let downloaded: string | null = null;
  const withItem = buildInfiniteNodeMenuHandlers(
    imageNode(),
    baseCtx({ onDownloadItem: (item) => { downloaded = item.id; } }),
  );
  withItem.onDownload?.();
  assert("download with item", downloaded === "img-1");

  let opened = "";
  const noItem = buildInfiniteNodeMenuHandlers(
    imageNode("orphan"),
    baseCtx({ items: [] }),
    { openAssetUrl: (url) => { opened = url; } },
  );
  noItem.onDownload?.();
  assert("download without item opens asset url", opened.includes("example.com"));
}

// drama stub handlers 可调用（P2-5 前占位）
{
  const handlers = buildInfiniteNodeMenuHandlers(imageNode(), baseCtx());
  let threw = false;
  try {
    handlers.onGenerateShotImage?.();
    handlers.onGenerateShotVideo?.();
    handlers.onGenerateCharacterSheet?.();
  } catch {
    threw = true;
  }
  assert("drama stub handlers callable", !threw);
  assert(
    "drama edit routes node id",
    typeof handlers.onEditScript === "function",
  );
}

// text 节点无 cutout（无 canvas item）
{
  const textNode: CanvasNodeData = {
    ...imageNode("text-1"),
    type: CanvasNodeType.Text,
  };
  const handlers = buildInfiniteNodeMenuHandlers(
    textNode,
    baseCtx({ onCutoutItem: () => {} }),
  );
  assert("text node -> cutout undefined", handlers.onCutout === undefined);
  assert("text node -> delete defined", typeof handlers.onDelete === "function");
}

const failed = results.filter((r) => !r.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} test(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${results.length} infinite-node-menu-handlers tests passed.`);
