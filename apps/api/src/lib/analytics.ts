import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";

export function recordAnalyticsEvent(
  userId: string | null | undefined,
  name: string,
  props?: Record<string, string | number | boolean>,
) {
  db.prepare(
    `INSERT INTO analytics_events (id, user_id, name, props_json) VALUES (?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    userId ?? null,
    name,
    props ? JSON.stringify(props) : null,
  );
}
