import { Hono } from "hono";
import { z } from "zod";
import { listSkillsPublic } from "@aimarket/agent-skills";
import type { AuthVariables } from "../middleware/auth.js";
import { dispatchSkillRun } from "../lib/agent/skill-dispatch.js";
import { executeSkillRun } from "../lib/agent/skill-executor.js";
import {
  createSkillRun,
  getSkillRun,
  serializeSkillRunForApi,
  updateSkillRun,
} from "../lib/agent/skill-runs.js";
import { AppError } from "../lib/errors.js";
import { assertSessionWrite } from "../lib/session-access.js";

const skills = new Hono<{ Variables: AuthVariables }>();

skills.get("/", (c) => {
  return c.json({
    data: listSkillsPublic().filter((s) => s.id !== "drama-short-v1"),
  });
});

const startBody = z.object({
  sessionId: z.string().uuid(),
  prompt: z.string().min(1).max(4000),
  productAssetId: z.string().uuid().optional(),
  referenceAssetId: z.string().uuid().optional(),
  confirmed: z.boolean().default(false),
});

skills.post("/:skillId/runs", async (c) => {
  const userId = c.get("userId");
  const skillId = c.req.param("skillId");
  const body = startBody.parse(await c.req.json());
  assertSessionWrite(userId, body.sessionId);

  const { row } = createSkillRun({
    sessionId: body.sessionId,
    userId,
    skillId,
    prompt: body.prompt.trim(),
    productAssetId: body.productAssetId,
    referenceAssetId: body.referenceAssetId,
    confirmed: body.confirmed,
  });

  if (row.status !== "waiting_confirm") {
    dispatchSkillRun(row.id, userId);
  }

  return c.json({ data: serializeSkillRunForApi(row) }, 201);
});

skills.get("/runs/:id", async (c) => {
  const userId = c.get("userId");
  const runId = c.req.param("id");
  const row = getSkillRun(userId, runId);
  if (!row) {
    throw new AppError(404, "NOT_FOUND", "Skill Run 不存在");
  }
  return c.json({ data: serializeSkillRunForApi(row) });
});

skills.post("/runs/:id/confirm", async (c) => {
  const userId = c.get("userId");
  const runId = c.req.param("id");
  const row = getSkillRun(userId, runId);
  if (!row) {
    throw new AppError(404, "NOT_FOUND", "Skill Run 不存在");
  }
  if (row.status !== "waiting_confirm") {
    throw new AppError(400, "INVALID_STATE", "当前不在待确认状态");
  }
  assertSessionWrite(userId, row.session_id);
  updateSkillRun(runId, { status: "queued" });
  dispatchSkillRun(runId, userId);
  const next = getSkillRun(userId, runId)!;
  return c.json({ data: serializeSkillRunForApi(next) });
});

skills.post("/runs/:id/cancel", async (c) => {
  const userId = c.get("userId");
  const runId = c.req.param("id");
  const row = getSkillRun(userId, runId);
  if (!row) {
    throw new AppError(404, "NOT_FOUND", "Skill Run 不存在");
  }
  updateSkillRun(runId, {
    status: "cancelled",
    error: "用户取消",
    pendingJobId: null,
  });
  const next = getSkillRun(userId, runId)!;
  return c.json({ data: serializeSkillRunForApi(next) });
});

export { skills };

/** 供 workflow-worker / Inngest 调用（不经 JWT，仅内部密钥） */
export const skillInternal = new Hono();

skillInternal.post("/skill-runs/:id/execute", async (c) => {
  const secret = c.req.header("X-Internal-Secret");
  if (
    !process.env.INTERNAL_API_SECRET ||
    secret !== process.env.INTERNAL_API_SECRET
  ) {
    throw new AppError(403, "FORBIDDEN", "无效的内部密钥");
  }
  const runId = c.req.param("id");
  const body = z.object({ userId: z.string().uuid() }).parse(await c.req.json());
  const row = await executeSkillRun(runId, body.userId);
  if (!row) {
    throw new AppError(404, "NOT_FOUND", "Skill Run 不存在");
  }
  return c.json({ data: serializeSkillRunForApi(row) });
});
