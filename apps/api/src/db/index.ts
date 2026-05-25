import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const dbPath =
  process.env.DATABASE_PATH ??
  path.join(process.cwd(), "data", "aimarket.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const database = new DatabaseSync(dbPath);

database.exec("PRAGMA journal_mode = WAL");
database.exec("PRAGMA foreign_keys = ON");

function prepare(sql: string) {
  const stmt = database.prepare(sql);
  return {
    run: (...params: SQLInputValue[]) => {
      stmt.run(...params);
    },
    get: (...params: SQLInputValue[]) =>
      stmt.get(...params) as Record<string, unknown> | undefined,
    all: (...params: SQLInputValue[]) =>
      stmt.all(...params) as Record<string, unknown>[],
  };
}

function transaction<T>(fn: () => T): T {
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export const db = { prepare, transaction, exec: (sql: string) => database.exec(sql) };

database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    credits INTEGER NOT NULL DEFAULT 100,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS image_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '未命名',
    mode TEXT NOT NULL DEFAULT 'chat',
    status TEXT NOT NULL DEFAULT 'idle',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES image_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    job_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS message_outputs (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT REFERENCES image_sessions(id) ON DELETE SET NULL,
    filename TEXT NOT NULL,
    url TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS generation_jobs (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES image_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    mode TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    resolution TEXT NOT NULL DEFAULT '1k',
    status TEXT NOT NULL DEFAULT 'queued',
    points_cost INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS job_outputs (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON image_sessions(user_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at ASC);
  CREATE INDEX IF NOT EXISTS idx_jobs_session ON generation_jobs(session_id, created_at DESC);
`);

try {
  database.exec(`ALTER TABLE generation_jobs ADD COLUMN tool_type TEXT`);
} catch {
  /* column exists */
}
try {
  database.exec(
    `ALTER TABLE generation_jobs ADD COLUMN aspect_ratio TEXT DEFAULT '1:1'`,
  );
} catch {
  /* column exists */
}
try {
  database.exec(
    `ALTER TABLE generation_jobs ADD COLUMN image_provider TEXT`,
  );
} catch {
  /* column exists */
}
try {
  database.exec(`ALTER TABLE image_sessions ADD COLUMN canvas_layout TEXT`);
} catch {
  /* column exists */
}

database.exec(`
  CREATE TABLE IF NOT EXISTS credit_packages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    credits INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    badge TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS credit_orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    package_id TEXT NOT NULL REFERENCES credit_packages(id),
    credits INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'paid',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sign_records (
    user_id TEXT NOT NULL REFERENCES users(id),
    sign_date TEXT NOT NULL,
    credits INTEGER NOT NULL,
    PRIMARY KEY (user_id, sign_date)
  );

  CREATE TABLE IF NOT EXISTS invite_codes (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    code TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invite_redemptions (
    id TEXT PRIMARY KEY,
    invitee_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    inviter_id TEXT NOT NULL REFERENCES users(id),
    code TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notices (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    link_label TEXT,
    link_path TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_notice_reads (
    user_id TEXT NOT NULL REFERENCES users(id),
    notice_id TEXT NOT NULL REFERENCES notices(id),
    read_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, notice_id)
  );

  CREATE TABLE IF NOT EXISTS brand_kits (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    brand_name TEXT,
    primary_color TEXT NOT NULL DEFAULT '#f97316',
    secondary_color TEXT NOT NULL DEFAULT '#a855f7',
    logo_url TEXT,
    font_hint TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const orderMigrations = [
  `ALTER TABLE credit_orders ADD COLUMN provider TEXT DEFAULT 'mock'`,
  `ALTER TABLE credit_orders ADD COLUMN external_id TEXT`,
  `ALTER TABLE credit_orders ADD COLUMN checkout_url TEXT`,
  `ALTER TABLE credit_orders ADD COLUMN paid_at TEXT`,
];

for (const sql of orderMigrations) {
  try {
    database.exec(sql);
  } catch {
    /* column exists */
  }
}

