/**
 * pnpm --filter @aimarket/api exec tsx ../../scripts/test-studio-draft-session.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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

const navSrc = readFileSync(
  resolve(repoRoot, "apps/web/src/lib/studio-navigation.ts"),
  "utf8",
);
const workspaceSrc = readFileSync(
  resolve(repoRoot, "apps/web/src/components/studio-workspace.tsx"),
  "utf8",
);
const panelSrc = readFileSync(
  resolve(repoRoot, "apps/web/src/components/creation-panel.tsx"),
  "utf8",
);

test("buildStudioUrl uses draft session helpers", () => {
  assert.match(navSrc, /allocateDraftSessionId/);
  assert.match(navSrc, /getOrCreateDraftSessionId/);
  assert.match(navSrc, /newDraft/);
});

test("studio init avoids eager ensure for blank draft", () => {
  assert.match(workspaceSrc, /mustPersist/);
  assert.match(workspaceSrc, /fetchSession/);
  assert.match(workspaceSrc, /本地草稿/);
});

test("creation panel does not ensure session on mount", () => {
  const mountEffect = panelSrc.slice(
    panelSrc.indexOf("useEffect(() => {"),
    panelSrc.indexOf("}, [user, sessionId, canvasMentionSignature, mode]);") +
      "}, [user, sessionId, canvasMentionSignature, mode]);".length,
  );
  assert.doesNotMatch(mountEffect, /ensureSession\(sessionId/);
  assert.match(mountEffect, /fetchSession\(sessionId\)/);
});

console.log(`\nAll ${results.length} studio-draft-session tests passed.`);
