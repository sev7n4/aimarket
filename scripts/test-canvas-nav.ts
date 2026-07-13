// scripts/test-canvas-nav.ts
import {
  panDeltaFromKey,
  zoomFactorFromKey,
  shouldStartPan,
  isContextMenuClick,
  shouldCapturePointerForRightPanCandidate,
  isEditableTarget,
  RIGHT_PAN_MOVE_THRESHOLD_PX,
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
ok(
  "right without move does not start pan",
  !shouldStartPan({ spacePressed: false, button: 2, rightDragMoved: false }),
);
ok(
  "right after move starts pan",
  shouldStartPan({ spacePressed: false, button: 2, rightDragMoved: true }),
);
ok("small move is context menu", isContextMenuClick(2));
ok("large move is drag", !isContextMenuClick(20));
ok(
  "threshold matches constant",
  isContextMenuClick(RIGHT_PAN_MOVE_THRESHOLD_PX - 1) &&
    !isContextMenuClick(RIGHT_PAN_MOVE_THRESHOLD_PX),
);
ok(
  "capture right pan candidate on background",
  shouldCapturePointerForRightPanCandidate(2, true),
);
ok(
  "no capture for right on node",
  !shouldCapturePointerForRightPanCandidate(2, false),
);
ok(
  "no capture for left background",
  !shouldCapturePointerForRightPanCandidate(0, true),
);
ok("input is editable", isEditableTarget({ tagName: "INPUT" }));
ok("textarea is editable", isEditableTarget({ tagName: "textarea" }));
ok("contenteditable is editable", isEditableTarget({ isContentEditable: true }));
ok("div is not editable", !isEditableTarget({ tagName: "DIV" }));
ok("null is not editable", !isEditableTarget(null));

const failed = results.filter((r) => !r.pass);
if (failed.length) process.exit(1);
console.log(`\n${results.length} passed`);
