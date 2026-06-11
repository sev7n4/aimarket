/**
 * canvas-batch-layout 单测
 * pnpm --filter @aimarket/web exec tsx ../../scripts/test-canvas-batch-layout.ts
 */
import type { CanvasItem } from "../apps/web/src/lib/canvas-tools.js";
import {
  batchOutputCountLabel,
  shouldUseMobileTwoColumnGrid,
} from "../apps/web/src/lib/canvas-batch-layout.js";

const results: { name: string; pass: boolean }[] = [];

function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

function item(partial: Partial<CanvasItem> & { id: string }): CanvasItem {
  return {
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    url: "https://example.com/a.png",
    isVideo: false,
    source: "generation",
    role: "output",
    ...partial,
  };
}

const twoImages = [item({ id: "a" }), item({ id: "b" })];
const fourImages = [
  item({ id: "a" }),
  item({ id: "b" }),
  item({ id: "c" }),
  item({ id: "d" }),
];
const withVideo = [
  item({ id: "a", isVideo: true, height: 112 }),
  item({ id: "b" }),
];

ok("mobile 2 images → 2-col", shouldUseMobileTwoColumnGrid(twoImages, true));
ok("mobile 4 images → 2-col", shouldUseMobileTwoColumnGrid(fourImages, true));
ok("mobile 1 image → flex", !shouldUseMobileTwoColumnGrid([item({ id: "a" })], true));
ok("desktop 2 images → flex", !shouldUseMobileTwoColumnGrid(twoImages, false));
ok("mixed video batch → no 2-col", !shouldUseMobileTwoColumnGrid(withVideo, true));
ok("video count label 段", batchOutputCountLabel(withVideo) === "2 段");
ok("image count label 张", batchOutputCountLabel(twoImages) === "2 张");

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} 通过\n`);
process.exit(failed > 0 ? 1 : 0);
