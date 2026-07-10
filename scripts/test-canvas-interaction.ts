/**
 * canvas interaction 单测
 * pnpm --filter @aimarket/api exec sh -c 'TSX_TSCONFIG_PATH=../web/tsconfig.json tsx ../../scripts/test-canvas-interaction.ts'
 */
import {
  applyDragDelta,
  constrainAxisDelta,
  snapToGrid,
} from "../apps/web/src/lib/canvas-interaction.ts";

const results: { name: string; pass: boolean }[] = [];
function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

ok("snap 25 → 20", snapToGrid(25, 20) === 20);
ok("snap 30 → 40", snapToGrid(30, 20) === 40);

ok(
  "axis lock horizontal",
  constrainAxisDelta(40, 10, true).dx === 40 &&
    constrainAxisDelta(40, 10, true).dy === 0,
);
ok(
  "axis lock vertical",
  constrainAxisDelta(5, 50, true).dx === 0 &&
    constrainAxisDelta(5, 50, true).dy === 50,
);
ok(
  "no lock keeps both",
  constrainAxisDelta(12, 8, false).dx === 12 &&
    constrainAxisDelta(12, 8, false).dy === 8,
);

const snapped = applyDragDelta({ x: 11, y: 9 }, 40, 10, {
  lockAxis: true,
  snapGrid: true,
  gridSize: 20,
});
ok("drag lock+snap x", snapped.x === 60);
ok("drag lock+snap y", snapped.y === 0);

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error("\nFailed:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
console.log(`\n${results.length} passed`);
