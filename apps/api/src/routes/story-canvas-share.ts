import { Hono } from "hono";
import type { AuthVariables } from "../middleware/auth.js";
import {
  cloneStoryCanvasShare,
  getStoryCanvasShareStatus,
  shareCloneBody,
  shareToggleBody,
  toggleStoryCanvasShare,
  viewStoryCanvasShare,
} from "../lib/story-canvas-share-service.js";

const storyCanvasShare = new Hono<{ Variables: AuthVariables }>();

storyCanvasShare.post("/toggle", async (c) => {
  const userId = c.get("userId");
  const body = shareToggleBody.parse(await c.req.json());
  const data = toggleStoryCanvasShare(userId, body);
  return c.json({ data });
});

storyCanvasShare.get("/status", (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.query("sessionId");
  if (!sessionId) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "sessionId required" } }, 400);
  }
  const data = getStoryCanvasShareStatus(userId, sessionId);
  return c.json({ data });
});

storyCanvasShare.get("/view", (c) => {
  const token = c.req.query("token");
  if (!token) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "token required" } }, 400);
  }
  const data = viewStoryCanvasShare(token);
  return c.json({ data });
});

storyCanvasShare.post("/clone", async (c) => {
  const userId = c.get("userId");
  const body = shareCloneBody.parse(await c.req.json());
  const data = cloneStoryCanvasShare(userId, body);
  return c.json({ data }, 201);
});

export { storyCanvasShare };
