import { Hono } from "hono";
import type { AuthVariables } from "../middleware/auth.js";
import { ensureInviteCode, getInviteStats } from "../lib/invite.js";

const invite = new Hono<{ Variables: AuthVariables }>();

invite.get("/generateCode", (c) => {
  const userId = c.get("userId");
  const stats = getInviteStats(userId);
  const origin = process.env.PUBLIC_WEB_URL ?? "http://localhost:3000";
  return c.json({
    data: {
      ...stats,
      inviteUrl: `${origin}/?invite=${stats.code}`,
    },
  });
});

export { invite };
