/**
 * canvas fitView 单测
 * pnpm --filter @aimarket/api exec sh -c 'TSX_TSCONFIG_PATH=../web/tsconfig.json tsx ../../scripts/test-canvas-viewport.ts'
 */
import { CanvasNodeType } from "../apps/web/src/components/infinite-canvas/types";
import { computeFitViewport } from "../apps/web/src/lib/canvas-viewport.ts";

const results: { name: string; pass: boolean }[] = [];
function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

const empty = computeFitViewport([], { width: 800, height: 600 });
ok("empty nodes centered 1x", empty.k === 1 && empty.x === 400 && empty.y === 300);

const farNodes = [
  {
    id: "a",
    type: CanvasNodeType.Image,
    title: "A",
    position: { x: 0, y: 0 },
    width: 200,
    height: 150,
  },
  {
    id: "b",
    type: CanvasNodeType.Image,
    title: "B",
    position: { x: 2000, y: 1500 },
    width: 200,
    height: 150,
  },
];
const fit = computeFitViewport(farNodes, { width: 800, height: 600 }, 64);
ok("far nodes scale down", fit.k < 1);
ok("far nodes scale above min", fit.k >= 0.05);

const contentCenterX = (0 + 2200) / 2;
const contentCenterY = (0 + 1650) / 2;
ok(
  "far nodes centered x",
  Math.abs(fit.x - (400 - contentCenterX * fit.k)) < 0.01,
);
ok(
  "far nodes centered y",
  Math.abs(fit.y - (300 - contentCenterY * fit.k)) < 0.01,
);

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error("\nFailed:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
console.log(`\n${results.length} passed`);
