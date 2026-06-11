import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

type SQLValue = string | number | null | boolean;

function toPgSql(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function adaptSql(sql: string) {
  return toPgSql(sql).replace(/datetime\('now'\)/gi, "NOW()");
}

export type DbHandle = {
  prepare: (sql: string) => {
    run: (...params: SQLValue[]) => Promise<void>;
    get: (...params: SQLValue[]) => Promise<Record<string, unknown> | undefined>;
    all: (...params: SQLValue[]) => Promise<Record<string, unknown>[]>;
  };
  transaction: <T>(fn: () => Promise<T>) => Promise<T>;
  exec: (sql: string) => Promise<void>;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadSchemaSql() {
  const schemaPath = path.join(__dirname, "migrations", "postgres.sql");
  return fs.readFileSync(schemaPath, "utf8");
}

let pool: pg.Pool | null = null;

function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL required for postgres");
    pool = new pg.Pool({ connectionString: url, max: 20 });
  }
  return pool;
}

async function runMigrations(client: pg.PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const row = await client.query(
    `SELECT id FROM schema_migrations WHERE id = '001_init'`,
  );
  if (!row.rowCount) {
    const sql = loadSchemaSql();
    await client.query(sql);
    await client.query(`INSERT INTO schema_migrations (id) VALUES ('001_init')`);
    console.log("[db:postgres] schema 001_init applied");
  }

  const row2 = await client.query(
    `SELECT id FROM schema_migrations WHERE id = '002_provider_task_id'`,
  );
  if (!row2.rowCount) {
    await client.query(
      `ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS provider_task_id TEXT`,
    );
    await client.query(
      `INSERT INTO schema_migrations (id) VALUES ('002_provider_task_id')`,
    );
    console.log("[db:postgres] migration 002_provider_task_id applied");
  }
}

export function createPostgresDb(): DbHandle {
  const p = getPool();

  void (async () => {
    const client = await p.connect();
    try {
      await runMigrations(client);
    } finally {
      client.release();
    }
  })();

  return {
    prepare(sql: string) {
      const text = adaptSql(sql);
      return {
        async run(...params: SQLValue[]) {
          await p.query(text, params);
        },
        async get(...params: SQLValue[]) {
          const res = await p.query(text, params);
          return res.rows[0] as Record<string, unknown> | undefined;
        },
        async all(...params: SQLValue[]) {
          const res = await p.query(text, params);
          return res.rows as Record<string, unknown>[];
        },
      };
    },
    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      const client = await p.connect();
      try {
        await client.query("BEGIN");
        const result = await fn();
        await client.query("COMMIT");
        return result;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
    async exec(sql: string) {
      await p.query(adaptSql(sql));
    },
  };
}
