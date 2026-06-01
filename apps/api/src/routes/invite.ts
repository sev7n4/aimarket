import { Hono } from "hono";
import type { AuthVariables } from "../middleware/auth.js";
import { ensureInviteCode, getInviteStats } from "../lib/invite.js";
import { getPublicWebUrl } from "../lib/public-url.js";

const invite = new Hono<{ Variables: AuthVariables }>();

invite.get("/generateCode", (c) => {
  const userId = c.get("userId");
  const stats = getInviteStats(userId);
  const origin = getPublicWebUrl();
  return c.json({
    data: {
      ...stats,
      inviteUrl: `${origin}/?invite=${stats.code}`,
    },
  });
});

export { invite };
