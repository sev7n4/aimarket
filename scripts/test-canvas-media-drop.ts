#!/usr/bin/env node
/**
 * Canvas media drop 纯函数单测
 * pnpm --filter @aimarket/api exec sh -c 'TSX_TSCONFIG_PATH=../web/tsconfig.json tsx ../../scripts/test-canvas-media-drop.ts'
 */
import {
  DEFAULT_MEDIA_DROP_GAP,
  filterMediaFiles,
  mediaDropPositions,
} from "../apps/web/src/lib/canvas-media-drop.ts";

const results: { name: string; pass: boolean }[] = [];

function assert(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

function file(name: string, type: string): File {
  return new File([new Uint8Array([1])], name, { type });
}

const mixed = [
  file("a.png", "image/png"),
  file("notes.txt", "text/plain"),
  file("clip.mp4", "video/mp4"),
  file("sheet.pdf", "application/pdf"),
  file("b.webp", "image/webp"),
];

const filtered = filterMediaFiles(mixed);
assert(
  "filter keeps image/* and video/* in order",
  filtered.length === 3 &&
    filtered[0]?.name === "a.png" &&
    filtered[1]?.name === "clip.mp4" &&
    filtered[2]?.name === "b.webp",
);
assert("filter empty input → []", filterMediaFiles([]).length === 0);
assert(
  "filter drops non-media",
  filterMediaFiles([file("x.txt", "text/plain")]).length === 0,
);

const origin = { x: 100, y: 200 };
assert(
  "positions count 0 → []",
  mediaDropPositions(0, origin).length === 0,
);
assert(
  "positions count 1 → origin",
  mediaDropPositions(1, origin)[0]?.x === 100 &&
    mediaDropPositions(1, origin)[0]?.y === 200,
);
const three = mediaDropPositions(3, origin);
assert(
  "positions default gap horizontal",
  three.length === 3 &&
    three[0]?.x === 100 &&
    three[1]?.x === 100 + DEFAULT_MEDIA_DROP_GAP &&
    three[2]?.x === 100 + DEFAULT_MEDIA_DROP_GAP * 2 &&
    three.every((p) => p.y === 200),
);
const custom = mediaDropPositions(2, { x: 0, y: 0 }, 50);
assert(
  "positions custom gap",
  custom[0]?.x === 0 && custom[1]?.x === 50,
);

const failed = results.filter((r) => !r.pass).length;
if (failed > 0) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log(`\n${results.length} passed`);
