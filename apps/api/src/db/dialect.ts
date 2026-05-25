export type DbDialect = "sqlite" | "postgres";

export function getDbDialect(): DbDialect {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return "postgres";
  }
  return "sqlite";
}

/** 用于 UPDATE/INSERT 表达式 */
export function sqlNow(): string {
  return getDbDialect() === "postgres" ? "NOW()" : "datetime('now')";
}

/** 分析类查询：近 N 天 */
export function sqlAnalyticsSinceDays(): string {
  return getDbDialect() === "postgres"
    ? `created_at >= NOW() - ($1::int * INTERVAL '1 day')`
    : `created_at >= datetime('now', printf('-%d days', ?))`;
}
