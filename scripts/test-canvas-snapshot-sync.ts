#!/usr/bin/env node
/**
 * Infinite 快照 ↔ canvas_layout 合并单测（防 layout 同步丢失）
 * pnpm --filter @aimarket/api exec sh -c 'TSX_TSCONFIG_PATH=../web/tsconfig.json tsx ../../scripts/test-canvas-snapshot-sync.ts'
 */
import { mergeSnapshotToCanvasItems } from "../apps/web/src/components/infinite-canvas/sync-infinite-snapshot.ts";
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

function imageNode(
  id: string,
  x: number,
  y: number,
  w = 200,
  h = 200,
): CanvasNodeData {
  return {
    id,
    type: CanvasNodeType.Image,
    title: "img",
    position: { x, y },
    width: w,
    height: h,
    metadata: { content: `https://example.com/${id}.png` },
  };
}

// 已有 item：位置/尺寸从 snapshot 更新
{
  const items: CanvasItem[] = [
    {
      id: "img-1",
      url: "https://example.com/img-1.png",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    },
  ];
  const merged = mergeSnapshotToCanvasItems(items, [
    imageNode("img-1", 50, 60, 320, 240),
  ]);
  const item = merged.find((i) => i.id === "img-1");
  assert(
    "updates position and size",
    item?.x === 50 && item?.y === 60 && item?.width === 320 && item?.height === 240,
  );
}

// snapshot 中不存在的 item 被丢弃
{
  const items: CanvasItem[] = [
    { id: "gone", url: "https://example.com/gone.png", x: 0, y: 0, width: 100, height: 100 },
    { id: "kept", url: "https://example.com/kept.png", x: 0, y: 0, width: 100, height: 100 },
  ];
  const merged = mergeSnapshotToCanvasItems(items, [imageNode("kept", 1, 2)]);
  assert("drops items missing from snapshot", merged.length === 1 && merged[0]?.id === "kept");
}

// text 节点：写入 infiniteNodeType + meta
{
  const textNode: CanvasNodeData = {
    id: "note-1",
    type: CanvasNodeType.Text,
    title: "Note",
    position: { x: 10, y: 20 },
    width: 180,
    height: 80,
    metadata: { content: "hello", status: "idle", fontSize: 14 },
  };
  const merged = mergeSnapshotToCanvasItems([], [textNode]);
  const item = merged[0];
  assert("adds text node", item?.id === "note-1");
  assert("text infiniteNodeType", item?.infiniteNodeType === "text");
  assert("text meta content", item?.infiniteNodeMeta?.content === "hello");
}

// config 节点
{
  const configNode: CanvasNodeData = {
    id: "cfg-1",
    type: CanvasNodeType.Config,
    title: "生成配置",
    position: { x: 0, y: 0 },
    width: 240,
    height: 120,
    metadata: {
      content: "",
      status: "idle",
      generationMode: "video",
      prompt: "cinematic",
    },
  };
  const merged = mergeSnapshotToCanvasItems([], [configNode]);
  const item = merged[0];
  assert("config infiniteNodeType", item?.infiniteNodeType === "config");
  assert("config prompt preserved", item?.infiniteNodeMeta?.prompt === "cinematic");
  assert("config generationMode", item?.infiniteNodeMeta?.generationMode === "video");
}

// 已有 infinite text item：合并 meta + 坐标
{
  const items: CanvasItem[] = [
    {
      id: "note-1",
      url: "",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      infiniteNodeType: "text",
      infiniteNodeMeta: { content: "old", generationMode: "image", prompt: "" },
    },
  ];
  const merged = mergeSnapshotToCanvasItems(items, [
    {
      id: "note-1",
      type: CanvasNodeType.Text,
      title: "Updated",
      position: { x: 30, y: 40 },
      width: 200,
      height: 90,
      metadata: { content: "new text", status: "idle" },
    },
  ]);
  const item = merged[0];
  assert("merges text position", item?.x === 30 && item?.y === 40);
  assert("merges text content", item?.infiniteNodeMeta?.content === "new text");
  assert("merges text label", item?.label === "Updated");
}

// Drama 节点不写入 canvasItems
{
  const dramaNode: CanvasNodeData = {
    id: "drama-shot-1",
    type: CanvasNodeType.Shot,
    title: "Shot 1",
    position: { x: 0, y: 0 },
    width: 200,
    height: 100,
    metadata: { shotOrder: 1 },
  };
  const merged = mergeSnapshotToCanvasItems([], [dramaNode, imageNode("img-new", 5, 5)]);
  assert(
    "filters drama nodes from output",
    merged.length === 1 && merged[0]?.id === "img-new",
  );
}

// 新增 image 节点从 snapshot 加入
{
  const merged = mergeSnapshotToCanvasItems([], [imageNode("new-img", 7, 8)]);
  assert(
    "adds new image from snapshot",
    merged.length === 1 && merged[0]?.url.includes("new-img"),
  );
}

const failed = results.filter((r) => !r.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} test(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${results.length} canvas-snapshot-sync tests passed.`);
