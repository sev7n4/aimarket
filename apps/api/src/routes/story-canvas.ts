import { Hono } from "hono";
import type { AuthVariables } from "../middleware/auth.js";
import {
  batchQueryWorkflowStatus,
  runWorkflowImageGeneration,
  runWorkflowVideoGeneration,
  storyCanvasSchemas,
} from "../lib/story-canvas-service.js";
import {
  runWorkflowAudio,
  runWorkflowLighting,
  runWorkflowLipSync,
  runWorkflowMotionControl,
  runWorkflowMusic,
  runWorkflowOutpainting,
  runWorkflowPoseReference,
  runWorkflowUpscale,
  workflowAudioBody,
  workflowLightingBody,
  workflowLipSyncBody,
  workflowMotionBody,
  workflowMusicBody,
  workflowOutpaintingBody,
  workflowRunBaseBody,
  workflowUpscaleBody,
} from "../lib/story-canvas-tool-run.js";

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

storyCanvas.post("/outpainting", async (c) => {
  const userId = c.get("userId");
  const body = workflowOutpaintingBody.parse(await c.req.json());
  const data = runWorkflowOutpainting(userId, body);
  return c.json({ data });
});

storyCanvas.post("/upscale-image", async (c) => {
  const userId = c.get("userId");
  const body = workflowUpscaleBody.parse(await c.req.json());
  const data = runWorkflowUpscale(userId, body);
  return c.json({ data });
});

storyCanvas.post("/lighting", async (c) => {
  const userId = c.get("userId");
  const body = workflowLightingBody.parse(await c.req.json());
  const data = runWorkflowLighting(userId, body);
  return c.json({ data });
});

storyCanvas.post("/generate-music", async (c) => {
  const userId = c.get("userId");
  const body = workflowMusicBody.parse(await c.req.json());
  const data = runWorkflowMusic(userId, body);
  return c.json({ data });
});

storyCanvas.post("/generate-audio", async (c) => {
  const userId = c.get("userId");
  const body = workflowAudioBody.parse(await c.req.json());
  const data = runWorkflowAudio(userId, body);
  return c.json({ data });
});

storyCanvas.post("/lip-sync", async (c) => {
  const userId = c.get("userId");
  const body = workflowLipSyncBody.parse(await c.req.json());
  const data = runWorkflowLipSync(userId, body);
  return c.json({ data });
});

storyCanvas.post("/pose-reference", async (c) => {
  const userId = c.get("userId");
  const body = workflowRunBaseBody.parse(await c.req.json());
  const data = runWorkflowPoseReference(userId, body);
  return c.json({ data });
});

storyCanvas.post("/motion-control", async (c) => {
  const userId = c.get("userId");
  const body = workflowMotionBody.parse(await c.req.json());
  const data = runWorkflowMotionControl(userId, body);
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
