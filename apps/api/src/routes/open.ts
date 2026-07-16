import { Hono } from "hono";
import { assertSessionRead } from "../lib/session-access.js";
import {
  createOpenSession,
  openSessionCreateBodySchema,
  serializeOpenSession,
} from "../lib/open-sessions.js";
import { openWebhookRegisterBodySchema, registerOpenWebhook } from "../lib/open-webhooks.js";
import type { ApiKeyVariables } from "../middleware/api-key.js";

const open = new Hono<{ Variables: ApiKeyVariables }>();

open.post("/sessions", async (c) => {
  const userId = c.get("userId");
  const body = openSessionCreateBodySchema.parse(await c.req.json());
  const session = createOpenSession(userId, body);
  return c.json({ data: session }, 201);
});

open.get("/sessions/:id", (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("id");
  const session = assertSessionRead(userId, sessionId);
  return c.json({ data: serializeOpenSession(session) });
});

open.post("/webhooks", async (c) => {
  const userId = c.get("userId");
  const body = openWebhookRegisterBodySchema.parse(await c.req.json());
  const data = registerOpenWebhook(userId, body);
  return c.json({ data }, 201);
});

export { open };
