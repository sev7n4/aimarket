// scripts/test-canvas-nav.ts
import {
  panDeltaFromKey,
  zoomFactorFromKey,
  shouldStartPan,
  isContextMenuClick,
} from "../apps/web/src/lib/canvas-nav.ts";

const results: { name: string; pass: boolean }[] = [];
function ok(name: string, pass: boolean) {
  results.push({ name, pass });
  console.log(`${pass ? "✓" : "✗"} ${name}`);
}

ok("W pans up", panDeltaFromKey("w", false)?.dy === -40);
ok("Shift+D pans faster right", (panDeltaFromKey("d", true)?.dx ?? 0) > 40);
ok("E zooms in", (zoomFactorFromKey("e") ?? 0) > 1);
ok("Q zooms out", (zoomFactorFromKey("q") ?? 2) < 1);
ok("space+left starts pan", shouldStartPan({ spacePressed: true, button: 0, rightDragMoved: false }));
ok("middle starts pan", shouldStartPan({ spacePressed: false, button: 1, rightDragMoved: false }));
ok("small move is context menu", isContextMenuClick(2));
ok("large move is drag", !isContextMenuClick(20));

const failed = results.filter((r) => !r.pass);
if (failed.length) process.exit(1);
console.log(`\n${results.length} passed`);
