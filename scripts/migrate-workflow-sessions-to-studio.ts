#!/usr/bin/env node
/**
 * 将存量 workflow session 标记为 studio shell（若 schema 支持 shell 字段）。
 *
 * 用法:
 *   pnpm --filter @aimarket/api exec tsx ../../scripts/migrate-workflow-sessions-to-studio.ts
 *   pnpm --filter @aimarket/api exec tsx ../../scripts/migrate-workflow-sessions-to-studio.ts --dry-run
 */
import { db } from "../apps/api/src/db/index.js";

const dryRun = process.argv.includes("--dry-run");

const tableInfo = db
  .prepare("PRAGMA table_info(image_sessions)")
  .all() as Array<{ name: string }>;

const hasShellColumn = tableInfo.some((col) => col.name === "shell");

if (!hasShellColumn) {
  console.log(
    "[migrate-workflow-sessions-to-studio] image_sessions.shell column not found — no-op.",
  );
  process.exit(0);
}

type WorkflowSession = { id: string; title: string; shell: string | null };

const rows = db
  .prepare(
    `SELECT id, title, shell FROM image_sessions WHERE shell = 'workflow' OR shell IS NULL`,
  )
  .all() as WorkflowSession[];

const targets = rows.filter((r) => r.shell === "workflow");

console.log(
  dryRun
    ? `[dry-run] Found ${targets.length} workflow session(s) to migrate`
    : `Found ${targets.length} workflow session(s) to migrate`,
);

for (const row of targets) {
  console.log(`  - ${row.id}  shell=${row.shell ?? "null"}  title=${row.title}`);
}

if (targets.length === 0) {
  console.log("\nNothing to migrate.");
  process.exit(0);
}

if (dryRun) {
  console.log(
    `\n[dry-run] Would set shell=studio on ${targets.length} session(s).`,
  );
  process.exit(0);
}

const update = db.prepare(
  `UPDATE image_sessions SET shell = 'studio', updated_at = datetime('now') WHERE id = ?`,
);

db.transaction(() => {
  for (const row of targets) {
    update.run(row.id);
  }
});

console.log(`\nMigrated ${targets.length} session(s) to shell=studio.`);
