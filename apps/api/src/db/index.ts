import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
export { getDbDialect, sqlNow, sqlAnalyticsSinceDays } from "./dialect.js";

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
    thumb_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT REFERENCES image_sessions(id) ON DELETE SET NULL,
    filename TEXT NOT NULL,
    url TEXT NOT NULL,
    thumb_url TEXT,
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
    thumb_url TEXT,
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
  database.exec(
    `ALTER TABLE generation_jobs ADD COLUMN tool_context TEXT`,
  );
} catch {
  /* column exists */
}
try {
  database.exec(
    `ALTER TABLE generation_jobs ADD COLUMN parent_job_id TEXT REFERENCES generation_jobs(id)`,
  );
} catch {
  /* column exists */
}
try {
  database.exec(
    `ALTER TABLE generation_jobs ADD COLUMN source_output_id TEXT`,
  );
} catch {
  /* column exists */
}
try {
  database.exec(
    `ALTER TABLE generation_jobs ADD COLUMN source_lane TEXT`,
  );
} catch {
  /* column exists */
}
try {
  database.exec(
    `ALTER TABLE generation_jobs ADD COLUMN provider_task_id TEXT`,
  );
} catch {
  /* column exists */
}
try {
  database.exec(`ALTER TABLE image_sessions ADD COLUMN canvas_layout TEXT`);
} catch {
  /* column exists */
}
try {
  database.exec(
    `ALTER TABLE image_sessions ADD COLUMN kind TEXT NOT NULL DEFAULT 'canvas'`,
  );
} catch {
  /* column exists */
}
try {
  database.exec(`ALTER TABLE image_sessions ADD COLUMN workspace_id TEXT`);
} catch {
  /* column exists */
}
try {
  database.exec(`ALTER TABLE users ADD COLUMN phone TEXT`);
} catch {
  /* column exists */
}
try {
  database.exec(`ALTER TABLE users ADD COLUMN wechat_open_id TEXT`);
} catch {
  /* column exists */
}
try {
  database.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL`,
  );
} catch {
  /* index exists */
}
try {
  database.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wechat ON users(wechat_open_id) WHERE wechat_open_id IS NOT NULL`,
  );
} catch {
  /* index exists */
}

try {
  database.exec(`ALTER TABLE users ADD COLUMN email_verified_at TEXT`);
} catch {
  /* column exists */
}
try {
  database.exec(
    `ALTER TABLE users ADD COLUMN pending_credits INTEGER NOT NULL DEFAULT 0`,
  );
} catch {
  /* column exists */
}
try {
  database.exec(
    `ALTER TABLE invite_redemptions ADD COLUMN rewards_granted_at TEXT`,
  );
} catch {
  /* column exists */
}

database.exec(`
  CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_email_verify_user ON email_verification_tokens(user_id, created_at DESC);
`);

database.exec(`
  UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL;
`);

database.exec(`
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_personal INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    PRIMARY KEY (workspace_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS workspace_invites (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    max_uses INTEGER,
    use_count INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_workspace_invites_code ON workspace_invites(code);

  CREATE TABLE IF NOT EXISTS content_reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT REFERENCES image_sessions(id) ON DELETE SET NULL,
    job_id TEXT,
    reason TEXT NOT NULL,
    content_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    reviewed_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_reports_status ON content_reports(status, created_at DESC);

  CREATE TABLE IF NOT EXISTS analytics_events (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    props_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_analytics_name ON analytics_events(name, created_at DESC);

  CREATE TABLE IF NOT EXISTS inspiration_templates (
    id TEXT PRIMARY KEY,
    legacy_id INTEGER NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    prompt_template TEXT NOT NULL,
    variables_json TEXT,
    model_id TEXT NOT NULL,
    aspect_ratio TEXT NOT NULL DEFAULT 'auto',
    resolution TEXT NOT NULL DEFAULT '1k',
    cover_url TEXT NOT NULL,
    reference_assets_json TEXT,
    status TEXT NOT NULL DEFAULT 'published',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_inspiration_published
    ON inspiration_templates(status, sort_order ASC, legacy_id ASC);

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
    rewards_granted_at TEXT,
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

  CREATE TABLE IF NOT EXISTS user_provider_config (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    use_byok INTEGER NOT NULL DEFAULT 0,
    openai_key_enc TEXT,
    openai_base_url TEXT,
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

const productMigrations = [
  `ALTER TABLE image_sessions ADD COLUMN source_inspiration_id TEXT`,
  `ALTER TABLE image_sessions ADD COLUMN template_variables_json TEXT`,
  `ALTER TABLE message_outputs ADD COLUMN label TEXT`,
  `ALTER TABLE job_outputs ADD COLUMN label TEXT`,
  `ALTER TABLE message_outputs ADD COLUMN thumb_url TEXT`,
  `ALTER TABLE job_outputs ADD COLUMN thumb_url TEXT`,
  `ALTER TABLE assets ADD COLUMN thumb_url TEXT`,
];

for (const sql of productMigrations) {
  try {
    database.exec(sql);
  } catch {
    /* column exists */
  }
}

database.exec(`
  CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES image_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'planning',
    prompt TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'chat',
    plan_json TEXT,
    current_step_index INTEGER NOT NULL DEFAULT 0,
    pending_job_id TEXT,
    state_json TEXT,
    plan_source TEXT,
    skill_id TEXT,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS agent_run_jobs (
    run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    job_id TEXT NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (run_id, job_id)
  );

  CREATE INDEX IF NOT EXISTS idx_agent_runs_session ON agent_runs(session_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_agent_run_jobs_job ON agent_run_jobs(job_id);

  CREATE TABLE IF NOT EXISTS skill_runs (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES image_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id TEXT NOT NULL,
    skill_version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'queued',
    prompt TEXT NOT NULL,
    inputs_json TEXT,
    current_step_index INTEGER NOT NULL DEFAULT 0,
    pending_job_id TEXT,
    step_outputs_json TEXT,
    estimated_points INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS skill_run_jobs (
    skill_run_id TEXT NOT NULL REFERENCES skill_runs(id) ON DELETE CASCADE,
    job_id TEXT NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
    step_id TEXT NOT NULL,
    PRIMARY KEY (skill_run_id, job_id)
  );

  CREATE INDEX IF NOT EXISTS idx_skill_runs_session ON skill_runs(session_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_skill_run_jobs_job ON skill_run_jobs(job_id);

  CREATE TABLE IF NOT EXISTS drama_projects (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES image_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_idea TEXT NOT NULL,
    project_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'drafting',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS drama_runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES drama_projects(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL REFERENCES image_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id TEXT NOT NULL DEFAULT 'drama-short-v1',
    status TEXT NOT NULL DEFAULT 'planning',
    current_step_index INTEGER NOT NULL DEFAULT 0,
    pending_job_id TEXT,
    progress_json TEXT,
    step_outputs_json TEXT,
    estimated_points INTEGER NOT NULL DEFAULT 0,
    final_video_url TEXT,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS drama_run_jobs (
    drama_run_id TEXT NOT NULL REFERENCES drama_runs(id) ON DELETE CASCADE,
    job_id TEXT NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
    step_id TEXT NOT NULL,
    shot_id TEXT,
    PRIMARY KEY (drama_run_id, job_id)
  );

  CREATE INDEX IF NOT EXISTS idx_drama_projects_session ON drama_projects(session_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_drama_runs_session ON drama_runs(session_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_drama_run_jobs_job ON drama_run_jobs(job_id);

  CREATE TABLE IF NOT EXISTS drama_plan_runs (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES image_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_idea TEXT NOT NULL,
    target_duration_sec INTEGER,
    aspect_ratio TEXT,
    status TEXT NOT NULL DEFAULT 'planning',
    current_agent TEXT,
    agents_json TEXT NOT NULL DEFAULT '{}',
    reasoning_json TEXT,
    project_id TEXT REFERENCES drama_projects(id) ON DELETE SET NULL,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_drama_plan_runs_session ON drama_plan_runs(session_id, updated_at DESC);
`);

try {
  database.exec(
    `ALTER TABLE drama_plan_runs ADD COLUMN auto_produce INTEGER NOT NULL DEFAULT 0`,
  );
} catch {
  /* column exists */
}

database.exec(`
  UPDATE invite_redemptions SET rewards_granted_at = created_at WHERE rewards_granted_at IS NULL;
`);

database.exec(`
  CREATE TABLE IF NOT EXISTS session_shares (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES image_sessions(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT,
    revoked_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_session_shares_session ON session_shares(session_id, created_at DESC);
`);

