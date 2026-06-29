import { Hono } from "hono";
import { z } from "zod";
import { streamSSE } from "hono/streaming";
import type { AuthVariables } from "../middleware/auth.js";
import { getAgentRunApiView, startAgentRun } from "../lib/agent/runner.js";
import { createAgentRun, getAgentRun, updateAgentRun } from "../lib/agent/runs.js";
import { resolveAgentPlan } from "../lib/agent/resolve-plan.js";
import { createGenerationJob } from "../lib/jobs.js";
import { ECOMMERCE_SLIDES } from "../lib/ecommerce.js";
import { AppError } from "../lib/errors.js";
import { assertSessionWrite } from "../lib/session-access.js";
import { getTool } from "../lib/tools.js";
import { db } from "../db/index.js";
import { enrichPromptWithReferences } from "../lib/references.js";
import { confirmAgentRun } from "../lib/agent/runner.js";
import { isAgentLlmEnabled, type PlanStep } from "@aimarket/agent-core";

const agent = new Hono<{ Variables: AuthVariables }>();

const planBody = z.object({
  prompt: z.string().min(1).max(4000),
  mode: z.enum(["chat", "image", "ecommerce"]).default("image"),
  modelId: z.string().optional(),
  resolution: z.string().optional(),
  aspectRatio: z.string().optional(),
  count: z.number().int().min(1).max(8).optional(),
});

agent.post("/plan", async (c) => {
  const body = planBody.parse(await c.req.json());
  const plan = await resolveAgentPlan(body);
  return c.json({
    data: plan,
    meta: { llmEnabled: isAgentLlmEnabled() },
  });
});

const runBody = z.object({
  sessionId: z.string().uuid(),
  prompt: z.string().min(1).max(4000),
  mode: z.enum(["chat", "image", "ecommerce"]).default("image"),
  modelId: z.string().optional(),
  resolution: z.string().optional(),
  aspectRatio: z.string().optional(),
  count: z.number().int().min(1).max(8).optional(),
});

agent.post("/runs", async (c) => {
  const userId = c.get("userId");
  const body = runBody.parse(await c.req.json());
  assertSessionWrite(userId, body.sessionId);

  const row = createAgentRun({
    sessionId: body.sessionId,
    userId,
    prompt: body.prompt.trim(),
    mode: body.mode,
  });

  await startAgentRun(userId, row.id);
  const view = getAgentRunApiView(userId, row.id);
  return c.json({ data: view }, 201);
});

agent.get("/runs/:id", async (c) => {
  const userId = c.get("userId");
  const runId = c.req.param("id");
  const view = getAgentRunApiView(userId, runId);
  if (!view) {
    throw new AppError(404, "NOT_FOUND", "Agent Run 不存在");
  }
  return c.json({ data: view });
});

/** GET /runs/:id/stream — SSE 实时推送 Agent Run 状态变更 */
agent.get("/runs/:id/stream", (c) => {
  const userId = c.get("userId");
  const runId = c.req.param("id");

  // 验证 run 存在且属于用户
  const existing = getAgentRun(userId, runId);
  if (!existing) {
    throw new AppError(404, "NOT_FOUND", "Agent Run 不存在");
  }

  const TERMINAL = new Set(["completed", "failed", "cancelled"]);
  const POLL_MS = 800;
  const MAX_MS = 600_000; // 10 分钟超时

  return streamSSE(c, async (stream) => {
    let lastUpdatedAt = existing.updated_at;
    const deadline = Date.now() + MAX_MS;

    // 发送初始状态
    const initialView = getAgentRunApiView(userId, runId);
    if (initialView) {
      await stream.writeSSE({
        event: "state",
        data: JSON.stringify(initialView),
      });
      if (TERMINAL.has(initialView.status)) return;
    }

    // 轮询 DB 变更并推送
    await new Promise<void>((resolve) => {
      const interval = setInterval(async () => {
        if (Date.now() > deadline) {
          clearInterval(interval);
          resolve();
          return;
        }
        try {
          const row = getAgentRun(userId, runId);
          if (!row) {
            clearInterval(interval);
            resolve();
            return;
          }
          if (row.updated_at !== lastUpdatedAt) {
            lastUpdatedAt = row.updated_at;
            const view = getAgentRunApiView(userId, runId);
            if (view) {
              await stream.writeSSE({
                event: "state",
                data: JSON.stringify(view),
              });
              if (TERMINAL.has(view.status)) {
                clearInterval(interval);
                resolve();
              }
            }
          }
        } catch {
          // 忽略单次轮询错误
        }
      }, POLL_MS);

      // 客户端断开连接时清理
      stream.onAbort(() => {
        clearInterval(interval);
        resolve();
      });
    });
  });
});

agent.post("/runs/:id/confirm", async (c) => {
  const userId = c.get("userId");
  const runId = c.req.param("id");
  const existing = getAgentRun(userId, runId);
  if (!existing) {
    throw new AppError(404, "NOT_FOUND", "Agent Run 不存在");
  }
  assertSessionWrite(userId, existing.session_id);

  try {
    await confirmAgentRun(userId, runId);
  } catch (err) {
    if (err instanceof Error && err.message === "RUN_NOT_WAITING_CONFIRM") {
      throw new AppError(400, "INVALID_STATE", "当前 Run 不在待确认状态");
    }
    throw err;
  }

  const view = getAgentRunApiView(userId, runId);
  return c.json({ data: view });
});

agent.post("/runs/:id/cancel", async (c) => {
  const userId = c.get("userId");
  const runId = c.req.param("id");
  const row = getAgentRun(userId, runId);
  if (!row) {
    throw new AppError(404, "NOT_FOUND", "Agent Run 不存在");
  }
  if (row.status === "completed" || row.status === "cancelled") {
    const view = getAgentRunApiView(userId, runId);
    return c.json({ data: view });
  }
  updateAgentRun(runId, {
    status: "cancelled",
    error: "用户取消",
  });
  const view = getAgentRunApiView(userId, runId);
  return c.json({ data: view });
});

const executeBody = z.object({
  sessionId: z.string().uuid(),
  prompt: z.string().min(1),
  mode: z.enum(["chat", "image", "ecommerce"]).default("image"),
  modelId: z.string().optional(),
  resolution: z.string().optional(),
  aspectRatio: z.string().optional(),
  count: z.number().int().min(1).max(8).optional(),
  confirmed: z.boolean().default(false),
  sourceOutputId: z.string().optional(),
  productAssetId: z.string().uuid().optional(),
  referenceAssetId: z.string().uuid().optional(),
});

/** @deprecated 优先使用 POST /agent/skills/:skillId/runs 或 POST /agent/runs */
agent.post("/execute", async (c) => {
  c.header("Deprecation", "true");
  c.header("Link", '</api/v1/agent/runs>; rel="successor-version"');
  const userId = c.get("userId");
  const body = executeBody.parse(await c.req.json());
  assertSessionWrite(userId, body.sessionId);

  const plan = await resolveAgentPlan(body);
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

  const toolSteps = plan.steps.filter((s: PlanStep) => s.type === "tool");
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
      sourceLane: "agent",
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
    sourceLane: "agent",
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
