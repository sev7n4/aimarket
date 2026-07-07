#!/usr/bin/env node
/**
 * 焦点编辑快捷键单测（纯逻辑）
 * pnpm exec tsx scripts/test-focus-edit-shortcut.ts
 */
import {
  FOCUS_EDIT_SHORTCUT_KEY,
  isFocusEditShortcut,
} from "../apps/web/src/lib/focus-edit.ts";

const results: { name: string; pass: boolean; detail?: string }[] = [];

function ok(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
  const icon = pass ? "✓" : "✗";
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`);
}

function keyEvent(
  partial: Partial<KeyboardEvent> & Pick<KeyboardEvent, "key">,
): KeyboardEvent {
  return {
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    repeat: false,
    ...partial,
  } as KeyboardEvent;
}

ok("shortcut key is f", FOCUS_EDIT_SHORTCUT_KEY === "f");

ok(
  "⌘⇧F triggers",
  isFocusEditShortcut(
    keyEvent({ key: "f", metaKey: true, shiftKey: true }),
  ),
);

ok(
  "Ctrl+Shift+F triggers",
  isFocusEditShortcut(
    keyEvent({ key: "F", ctrlKey: true, shiftKey: true }),
  ),
);

ok(
  "⌘ alone does not trigger (copy paste safe)",
  !isFocusEditShortcut(keyEvent({ key: "Meta", metaKey: true })),
);

ok(
  "⌘C does not trigger",
  !isFocusEditShortcut(
    keyEvent({ key: "c", metaKey: true }),
  ),
);

ok(
  "⌘⇧C does not trigger",
  !isFocusEditShortcut(
    keyEvent({ key: "c", metaKey: true, shiftKey: true }),
  ),
);

ok(
  "⌘F alone does not trigger",
  !isFocusEditShortcut(
    keyEvent({ key: "f", metaKey: true }),
  ),
);

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error(`\n${failed.length} failed`);
  process.exit(1);
}
console.log(`\n${results.length} passed`);
