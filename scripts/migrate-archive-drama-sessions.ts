#!/usr/bin/env node
/**
 * 归档存量 Drama/Production 会话（mode=production|ecommerce）。
 *
 * 用法:
 *   pnpm --filter @aimarket/api exec tsx ../../scripts/migrate-archive-drama-sessions.ts
 *   pnpm --filter @aimarket/api exec tsx ../../scripts/migrate-archive-drama-sessions.ts --dry-run
 */
import { db } from "../apps/api/src/db/index.js";

const LEGACY_MODES = ["production", "ecommerce"] as const;
const dryRun = process.argv.includes("--dry-run");

type LegacySession = {
  id: string;
  title: string;
  mode: string;
  status: string;
};

const rows = db
  .prepare(
    `SELECT id, title, mode, status
     FROM image_sessions
     WHERE mode IN (${LEGACY_MODES.map(() => "?").join(", ")})
     ORDER BY updated_at DESC`,
  )
  .all(...LEGACY_MODES) as LegacySession[];

console.log(
  dryRun
    ? `[dry-run] Found ${rows.length} legacy drama/production session(s)`
    : `Found ${rows.length} legacy drama/production session(s) to archive`,
);

for (const row of rows) {
  console.log(`  - ${row.id}  mode=${row.mode}  status=${row.status}  title=${row.title}`);
}

if (rows.length === 0) {
  console.log("\nNothing to migrate.");
  process.exit(0);
}

if (dryRun) {
  console.log(`\n[dry-run] Would archive ${rows.length} session(s) (status=archived, mode=image).`);
  process.exit(0);
}

const update = db.prepare(
  `UPDATE image_sessions
   SET status = 'archived',
       mode = 'image',
       updated_at = datetime('now')
   WHERE id = ?`,
);

db.transaction(() => {
  for (const row of rows) {
    update.run(row.id);
  }
});

console.log(`\nArchived ${rows.length} session(s).`);
