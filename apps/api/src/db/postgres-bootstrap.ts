/**
 * PostgreSQL 启动脚本（需 DATABASE_URL）
 * 用法: DATABASE_URL=postgresql://... pnpm --filter @aimarket/api exec tsx src/db/postgres-bootstrap.ts
 */
import { createPostgresDb } from "./postgres.js";

const db = createPostgresDb();
console.log("[postgres-bootstrap] migrations scheduled on pool init");
await new Promise((r) => setTimeout(r, 2000));
console.log("[postgres-bootstrap] done — wire DATABASE_URL in index.ts when API layer is fully async");
process.exit(0);
