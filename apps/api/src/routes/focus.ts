import { Hono } from "hono";
import type { AuthVariables } from "../middleware/auth.js";
import { parseFocusPointBody } from "../lib/focus.js";
import { recognizeFocusPoint } from "../lib/focus-point.js";
import { recordAnalyticsEvent } from "../lib/analytics.js";

const focus = new Hono<{ Variables: AuthVariables }>();

focus.post("/point", async (c) => {
  const userId = c.get("userId");
  const body = parseFocusPointBody(await c.req.json());
  const result = await recognizeFocusPoint(body);

  void recordAnalyticsEvent(userId, "focus.point", {
    session_id: body.sessionId,
    provider: result.provider,
  });

  return c.json({ data: result });
});

export { focus };
