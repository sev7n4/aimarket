import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../middleware/auth.js";
import { IMAGE_MODELS } from "../lib/models.js";
import { estimatePoints } from "../lib/pricing.js";
import { createGenerationJob, getJob } from "../lib/jobs.js";
import { suggestModel } from "../lib/router.js";
import {
  enrichPromptWithReferences,
  resolveReferenceUrls,
} from "../lib/references.js";
import { db } from "../db/index.js";
import { AppError } from "../lib/errors.js";

const ai = new Hono<{ Variables: AuthVariables }>();

ai.get("/queryModels", (c) => c.json({ data: IMAGE_MODELS }));

ai.post("/suggestModel", async (c) => {
  const body = z
    .object({
      mode: z.enum(["chat", "quick", "ecommerce"]).default("chat"),
      prompt: z.string().default(""),
    })
    .parse(await c.req.json());

  const suggestion = suggestModel(body.mode, body.prompt);
  return c.json({ data: suggestion });
});

ai.post("/estimatePointsBatch", async (c) => {
  const body = z
    .object({
      items: z
        .array(
          z.object({
            modelId: z.string(),
            count: z.number().int().positive().default(1),
            resolution: z.string().default("1k"),
          }),
        )
        .min(1),
    })
    .parse(await c.req.json());

  const totalPoints = body.items.reduce(
    (sum, item) =>
      sum + estimatePoints(item.modelId, item.count, item.resolution),
    0,
  );

  return c.json({ data: { totalPoints, currency: "credits" } });
});

ai.post("/generate", async (c) => {
  const userId = c.get("userId");
  const body = z
    .object({
      sessionId: z.string().uuid(),
      prompt: z.string().min(1).max(4000),
      modelId: z.string().optional(),
      count: z.number().int().min(1).max(4).default(1),
      resolution: z.enum(["1k", "2k", "4k"]).default("1k"),
      mode: z.enum(["chat", "quick", "ecommerce"]).default("chat"),
      assetIds: z.array(z.string().uuid()).optional(),
      referenceOutputIds: z.array(z.string().uuid()).optional(),
      autoRoute: z.boolean().default(false),
    })
    .parse(await c.req.json());

  if (body.assetIds?.length) {
    for (const assetId of body.assetIds) {
      const asset = db
        .prepare("SELECT id FROM assets WHERE id = ? AND user_id = ?")
        .get(assetId, userId);
      if (!asset) throw new AppError(400, "INVALID_ASSET", "附件不存在");
    }
  }

  const route = suggestModel(body.mode, body.prompt);
  const modelId =
    body.autoRoute || !body.modelId ? route.modelId : body.modelId;

  const refUrls = body.referenceOutputIds
    ? resolveReferenceUrls(body.referenceOutputIds)
    : [];
  const assetUrls: string[] = [];
  if (body.assetIds?.length) {
    for (const assetId of body.assetIds) {
      const asset = db
        .prepare("SELECT url FROM assets WHERE id = ? AND user_id = ?")
        .get(assetId, userId) as { url: string } | undefined;
      if (asset) assetUrls.push(asset.url);
    }
  }

  let prompt = enrichPromptWithReferences(body.prompt, [
    ...refUrls,
    ...assetUrls,
  ]);

  const { jobId, pointsCost } = createGenerationJob({
    sessionId: body.sessionId,
    userId,
    prompt,
    modelId,
    mode: body.mode,
    count: body.count,
    resolution: body.resolution,
  });

  return c.json({
    data: {
      jobId,
      estimatedPoints: pointsCost,
      status: "queued",
      modelId,
      routeReason: body.autoRoute ? route.reason : undefined,
    },
  });
});

ai.get("/jobs/:jobId", (c) => {
  const userId = c.get("userId");
  const jobId = c.req.param("jobId");
  const job = getJob(jobId, userId);
  return c.json({ data: job });
});

export { ai };
