#!/usr/bin/env node
/**
 * 将 canvas_flow 遗留数据合并到 canvas_layout（仅 layout 为空时）。
 *
 * 用法:
 *   pnpm --filter @aimarket/api exec tsx ../../scripts/migrate-canvas-flow-to-layout.ts
 *   pnpm --filter @aimarket/api exec tsx ../../scripts/migrate-canvas-flow-to-layout.ts --dry-run
 */
import { db } from "../apps/api/src/db/index.js";
import { applyFlowToLayout } from "../apps/api/src/lib/canvas-flow-layout-bridge.js";
import type { CanvasFlow } from "../apps/api/src/lib/canvas-flow-store.js";
import {
  parseCanvasLayout,
  serializeCanvasLayout,
} from "../apps/api/src/lib/canvas-layout.js";

const dryRun = process.argv.includes("--dry-run");

type SessionRow = {
  id: string;
  title: string;
  canvas_layout: string | null;
  canvas_flow: string | null;
};

const rows = db
  .prepare(
    `SELECT id, title, canvas_layout, canvas_flow FROM image_sessions ORDER BY updated_at DESC`,
  )
  .all() as SessionRow[];

const targets: Array<{ id: string; title: string; itemCount: number }> = [];

for (const row of rows) {
  const layout = parseCanvasLayout(row.canvas_layout);
  if (layout && layout.items.length > 0) continue;
  if (!row.canvas_flow) continue;
  let legacy: CanvasFlow;
  try {
    legacy = JSON.parse(row.canvas_flow) as CanvasFlow;
  } catch {
    continue;
  }
  if (!legacy.nodes?.length) continue;
  const merged = applyFlowToLayout({ version: 1, items: [] }, legacy);
  targets.push({
    id: row.id,
    title: row.title,
    itemCount: merged.items.length,
  });
}

console.log(
  dryRun
    ? `[dry-run] Found ${targets.length} session(s) with empty layout + legacy canvas_flow`
    : `Found ${targets.length} session(s) with empty layout + legacy canvas_flow`,
);

for (const t of targets) {
  console.log(`  - ${t.id}  items=${t.itemCount}  title=${t.title}`);
}

if (targets.length === 0) {
  console.log("\nNothing to migrate.");
  process.exit(0);
}

if (dryRun) {
  console.log(
    `\n[dry-run] Would merge canvas_flow → canvas_layout for ${targets.length} session(s).`,
  );
  process.exit(0);
}

const update = db.prepare(
  `UPDATE image_sessions SET canvas_layout = ?, updated_at = datetime('now') WHERE id = ?`,
);

db.transaction(() => {
  for (const target of targets) {
    const row = rows.find((r) => r.id === target.id)!;
    const legacy = JSON.parse(row.canvas_flow!) as CanvasFlow;
    const merged = applyFlowToLayout({ version: 1, items: [] }, legacy);
    update.run(serializeCanvasLayout(merged), target.id);
  }
});

console.log(`\nMerged canvas_flow into canvas_layout for ${targets.length} session(s).`);
