import { Hono } from "hono";
import type { AuthVariables } from "../middleware/auth.js";
import {
  batchQueryWorkflowStatus,
  runWorkflowImageGeneration,
  runWorkflowVideoGeneration,
  storyCanvasSchemas,
} from "../lib/story-canvas-service.js";

const storyCanvas = new Hono<{ Variables: AuthVariables }>();

storyCanvas.post("/generate-image", async (c) => {
  const userId = c.get("userId");
  const body = storyCanvasSchemas.generateImageBody.parse(await c.req.json());
  const data = runWorkflowImageGeneration(userId, body);
  return c.json({ data });
});

storyCanvas.post("/generate-video", async (c) => {
  const userId = c.get("userId");
  const body = storyCanvasSchemas.generateVideoBody.parse(await c.req.json());
  const data = runWorkflowVideoGeneration(userId, body);
  return c.json({ data });
});

storyCanvas.get("/batch-query-status", (c) => {
  const userId = c.get("userId");
  const query = storyCanvasSchemas.batchStatusQuery.parse({
    sessionId: c.req.query("sessionId"),
    nodeKeys: c.req.query("nodeKeys"),
  });
  const nodeKeys = query.nodeKeys.split(",").map((k) => k.trim()).filter(Boolean);
  const data = batchQueryWorkflowStatus(userId, query.sessionId, nodeKeys);
  return c.json({ data });
});

export { storyCanvas };
