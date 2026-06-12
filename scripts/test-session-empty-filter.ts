/**
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-session-empty-filter.ts
 */
import assert from "node:assert/strict";
import {
  AUTO_SESSION_TITLES,
  EMPTY_CANVAS_LAYOUT_JSON,
  HIDE_EMPTY_AUTO_TITLED_SESSIONS_SQL,
} from "../apps/api/src/lib/session-empty.ts";

const results: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    results.push(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

test("auto session titles include defaults", () => {
  assert.ok(AUTO_SESSION_TITLES.has("未命名"));
  assert.ok(AUTO_SESSION_TITLES.has("新建画布"));
  assert.ok(AUTO_SESSION_TITLES.has("新建项目"));
});

test("hide SQL targets idle empty auto-titled sessions", () => {
  assert.match(HIDE_EMPTY_AUTO_TITLED_SESSIONS_SQL, /s\.status = 'idle'/);
  assert.match(HIDE_EMPTY_AUTO_TITLED_SESSIONS_SQL, /messages m/);
  assert.match(HIDE_EMPTY_AUTO_TITLED_SESSIONS_SQL, /assets a/);
  assert.match(HIDE_EMPTY_AUTO_TITLED_SESSIONS_SQL, /generation_jobs j/);
  assert.ok(
    HIDE_EMPTY_AUTO_TITLED_SESSIONS_SQL.includes(EMPTY_CANVAS_LAYOUT_JSON),
  );
});

console.log(`\nAll ${results.length} session-empty-filter tests passed.`);
