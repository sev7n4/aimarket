import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db/index.js";

export const OPEN_WEBHOOK_EVENTS = [
  "drama.plan.completed",
  "drama.plan.failed",
  "drama.run.completed",
  "drama.run.failed",
] as const;

export type OpenWebhookEvent = (typeof OPEN_WEBHOOK_EVENTS)[number];

export const openWebhookRegisterBodySchema = z.object({
  url: z.string().url(),
  events: z
    .array(z.enum(OPEN_WEBHOOK_EVENTS))
    .min(1)
    .max(OPEN_WEBHOOK_EVENTS.length),
  secret: z.string().min(8).max(128).optional(),
});

export interface OpenWebhookRow {
  id: string;
  user_id: string;
  url: string;
  events_json: string;
  secret: string | null;
  created_at: string;
  revoked_at: string | null;
}

function parseEvents(row: OpenWebhookRow): OpenWebhookEvent[] {
  try {
    const parsed = JSON.parse(row.events_json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is OpenWebhookEvent =>
      OPEN_WEBHOOK_EVENTS.includes(e as OpenWebhookEvent),
    );
  } catch {
    return [];
  }
}

export function serializeOpenWebhook(row: OpenWebhookRow) {
  return {
    id: row.id,
    url: row.url,
    events: parseEvents(row),
    hasSecret: Boolean(row.secret),
    createdAt: row.created_at,
  };
}

export function registerOpenWebhook(
  userId: string,
  input: z.infer<typeof openWebhookRegisterBodySchema>,
) {
  const id = randomUUID();
  const secret = input.secret ?? randomBytes(24).toString("base64url");
  db.prepare(
    `INSERT INTO open_webhooks (id, user_id, url, events_json, secret)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, userId, input.url, JSON.stringify(input.events), secret);

  const row = db
    .prepare(`SELECT * FROM open_webhooks WHERE id = ?`)
    .get(id) as unknown as OpenWebhookRow;

  return {
    ...serializeOpenWebhook(row),
    secret,
  };
}

export function listActiveOpenWebhooks(userId: string): OpenWebhookRow[] {
  return db
    .prepare(
      `SELECT * FROM open_webhooks WHERE user_id = ? AND revoked_at IS NULL`,
    )
    .all(userId) as unknown as OpenWebhookRow[];
}

export function dispatchOpenWebhooks(
  userId: string,
  event: OpenWebhookEvent,
  data: Record<string, unknown>,
) {
  const hooks = listActiveOpenWebhooks(userId);
  for (const hook of hooks) {
    const events = parseEvents(hook);
    if (!events.includes(event)) continue;
    void deliverOpenWebhook(hook, event, data);
  }
}

async function deliverOpenWebhook(
  hook: OpenWebhookRow,
  event: OpenWebhookEvent,
  data: Record<string, unknown>,
) {
  const payload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "MoyuOpenWebhook/1",
  };
  if (hook.secret) {
    headers["X-Moyu-Signature"] = createHmac("sha256", hook.secret)
      .update(body)
      .digest("hex");
  }

  try {
    const res = await fetch(hook.url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn(
        `[open-webhook] ${hook.url} responded ${res.status} for ${event}`,
      );
    }
  } catch (err) {
    console.warn(`[open-webhook] delivery failed ${hook.url}:`, err);
  }
}

export function notifyOpenPlanWebhook(
  userId: string,
  planRun: {
    id: string;
    session_id: string;
    project_id: string | null;
    status: string;
    error: string | null;
  },
) {
  const event: OpenWebhookEvent =
    planRun.status === "completed"
      ? "drama.plan.completed"
      : "drama.plan.failed";
  dispatchOpenWebhooks(userId, event, {
    planRunId: planRun.id,
    sessionId: planRun.session_id,
    projectId: planRun.project_id,
    status: planRun.status,
    error: planRun.error,
  });
}

export function notifyOpenRunWebhook(
  userId: string,
  run: {
    id: string;
    session_id: string;
    project_id: string;
    status: string;
    error: string | null;
    final_video_url: string | null;
  },
) {
  const event: OpenWebhookEvent =
    run.status === "completed" ? "drama.run.completed" : "drama.run.failed";
  dispatchOpenWebhooks(userId, event, {
    runId: run.id,
    sessionId: run.session_id,
    projectId: run.project_id,
    status: run.status,
    error: run.error,
    finalVideoUrl: run.final_video_url,
  });
}
