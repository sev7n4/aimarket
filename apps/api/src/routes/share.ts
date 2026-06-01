import { Hono } from "hono";
import { resolvePublicShare } from "../lib/session-share.js";

const share = new Hono();

share.get("/:token", (c) => {
  const token = c.req.param("token");
  const data = resolvePublicShare(token);
  return c.json({ data });
});

export { share };
