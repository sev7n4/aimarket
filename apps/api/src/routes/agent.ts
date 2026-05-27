import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../middleware/auth.js";
import { buildAgentPlan } from "../lib/planner.js";
import { createGenerationJob } from "../lib/jobs.js";
import { ECOMMERCE_SLIDES } from "../lib/ecommerce.js";
import { AppError } from "../lib/errors.js";
import { assertSessionWrite } from "../lib/session-access.js";
import { getTool } from "../lib/tools.js";
import { db } from "../db/index.js";
import { enrichPromptWithReferences } from "../lib/references.js";

const agent = new Hono<{ Variables: AuthVariables }>();

const planBody = z.object({
  prompt: z.string().min(1).max(4000),
  mode: z.enum(["chat", "quick", "ecommerce"]).default("chat"),
  modelId: z.string().optional(),
  resolution: z.string().optional(),
  aspectRatio: z.string().optional(),
  count: z.number().int().min(1).max(8).optional(),
});

agent.post("/plan", async (c) => {
  const body = planBody.parse(await c.req.json());
  const plan = buildAgentPlan(body);
  return c.json({ data: plan });
});

const executeBody = z.object({
  sessionId: z.string().uuid(),
  prompt: z.string().min(1),
  mode: z.enum(["chat", "quick", "ecommerce"]).default("chat"),
  modelId: z.string().optional(),
  resolution: z.string().optional(),
  aspectRatio: z.string().optional(),
  count: z.number().int().min(1).max(8).optional(),
  confirmed: z.boolean().default(false),
  sourceOutputId: z.string().optional(),
  productAssetId: z.string().uuid().optional(),
  referenceAssetId: z.string().uuid().optional(),
});

agent.post("/execute", async (c) => {
  const userId = c.get("userId");
  const body = executeBody.parse(await c.req.json());
  assertSessionWrite(userId, body.sessionId);

  const plan = buildAgentPlan(body);
  if (plan.requiresConfirm && !body.confirmed) {
    throw new AppError(
      400,
      "CONFIRM_REQUIRED",
      "请先确认执行计划后再提交",
    );
  }

  let prompt = body.prompt;
  if (plan.mode === "ecommerce") {
    if (!body.productAssetId) {
      throw new AppError(400, "VALIDATION_ERROR", "电商 Agent 执行需先上传商品图");
    }
    const assetUrls: string[] = [];
    for (const assetId of [body.productAssetId, body.referenceAssetId]) {
      if (!assetId) continue;
      const asset = db
        .prepare("SELECT url FROM assets WHERE id = ? AND user_id = ?")
        .get(assetId, userId) as { url: string } | undefined;
      if (asset) assetUrls.push(asset.url);
    }
    if (assetUrls.length) {
      prompt = enrichPromptWithReferences(prompt, assetUrls);
    }
  }

  const toolSteps = plan.steps.filter((s) => s.type === "tool");
  if (toolSteps.length === 1 && plan.steps.length === 1) {
    const toolId = toolSteps[0].toolId!;
    getTool(toolId);
    const { jobId, pointsCost } = createGenerationJob({
      sessionId: body.sessionId,
      userId,
      prompt,
      modelId: plan.modelId,
      mode: body.mode,
      count: 1,
      resolution: plan.resolution,
      aspectRatio: plan.aspectRatio,
      toolType: toolId,
    });
    return c.json({
      data: {
        jobId,
        estimatedPoints: pointsCost,
        status: "queued",
        plan,
      },
    });
  }

  const slideLabels =
    plan.mode === "ecommerce"
      ? ECOMMERCE_SLIDES.map((s) => s.label)
      : undefined;

  const { jobId, pointsCost } = createGenerationJob({
    sessionId: body.sessionId,
    userId,
    prompt,
    modelId: plan.modelId,
    mode: plan.mode,
    count: plan.count,
    resolution: plan.resolution,
    aspectRatio: plan.aspectRatio,
    toolType: plan.mode === "ecommerce" ? "ecommerce-set" : undefined,
    slideLabels,
  });

  return c.json({
    data: {
      jobId,
      estimatedPoints: pointsCost,
      status: "queued",
      plan,
    },
  });
});

export { agent };
