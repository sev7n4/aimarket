import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { assertSessionWrite } from "../lib/session-access.js";
import { planDramaProject } from "../lib/drama/planner.js";
import {
  createDramaProject,
  getDramaProject,
  serializeDramaProject,
  updateDramaProject,
} from "../lib/drama/projects.js";
import { dramaProjectSchema } from "../lib/drama/schema.js";
import {
  createDramaRun,
  getDramaRun,
  serializeDramaRun,
  updateDramaRun,
} from "../lib/drama/runs.js";
import {
  dispatchDramaRun,
  retryDramaShot,
} from "../lib/drama/executor.js";
import { estimateDramaPoints } from "../lib/drama/estimate.js";

const drama = new Hono<{ Variables: AuthVariables }>();

const createBody = z.object({
  sessionId: z.string().uuid(),
  userIdea: z.string().min(10).max(2000),
  targetDurationSec: z.number().int().min(60).max(180).optional(),
  aspectRatio: z.enum(["9:16", "16:9"]).optional(),
  confirmed: z.boolean().default(false),
  autoProduce: z.boolean().default(false),
});

/** 规划短剧项目（RHTV：大纲 → 角色资产表 → 分镜） */
drama.post("/runs", async (c) => {
  const userId = c.get("userId");
  const body = createBody.parse(await c.req.json());
  assertSessionWrite(userId, body.sessionId);

  const projectData = await planDramaProject({
    userIdea: body.userIdea,
    targetDurationSec: body.targetDurationSec,
    aspectRatio: body.aspectRatio,
  });

  const projectRow = createDramaProject({
    sessionId: body.sessionId,
    userId,
    project: projectData,
  });

  if (!body.autoProduce) {
    return c.json(
      {
        data: {
          project: serializeDramaProject(projectRow),
          estimatedPoints: estimateDramaPoints(projectData),
        },
      },
      201,
    );
  }

  const run = createDramaRun({
    sessionId: body.sessionId,
    userId,
    projectId: projectRow.id,
    confirmed: body.confirmed,
  });

  if (run.status !== "waiting_confirm") {
    dispatchDramaRun(run.id, userId);
  }

  return c.json(
    {
      data: serializeDramaRun(run, projectRow),
    },
    201,
  );
});

/** 确认规划后开始制作 */
drama.post("/projects/:projectId/produce", async (c) => {
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");
  const body = z
    .object({ sessionId: z.string().uuid(), confirmed: z.boolean().default(true) })
    .parse(await c.req.json());
  assertSessionWrite(userId, body.sessionId);

  const projectRow = getDramaProject(userId, projectId);
  if (!projectRow) {
    throw new AppError(404, "NOT_FOUND", "短剧项目不存在");
  }

  updateDramaProject(projectId, { status: "confirmed" });

  const run = createDramaRun({
    sessionId: body.sessionId,
    userId,
    projectId,
    confirmed: body.confirmed,
  });

  if (run.status !== "waiting_confirm") {
    dispatchDramaRun(run.id, userId);
  }

  return c.json({ data: serializeDramaRun(run, projectRow) }, 201);
});

drama.get("/projects/:id", async (c) => {
  const userId = c.get("userId");
  const row = getDramaProject(userId, c.req.param("id"));
  if (!row) throw new AppError(404, "NOT_FOUND", "短剧项目不存在");
  return c.json({ data: serializeDramaProject(row) });
});

drama.patch("/projects/:id", async (c) => {
  const userId = c.get("userId");
  const row = getDramaProject(userId, c.req.param("id"));
  if (!row) throw new AppError(404, "NOT_FOUND", "短剧项目不存在");
  const body = z
    .object({ project: z.record(z.unknown()).optional() })
    .parse(await c.req.json());
  if (body.project) {
    const current = JSON.parse(row.project_json);
    const merged = { ...current, ...body.project };
    const validated = dramaProjectSchema.parse(merged);
    updateDramaProject(row.id, { project: validated });
  }
  const next = getDramaProject(userId, row.id)!;
  return c.json({ data: serializeDramaProject(next) });
});

drama.get("/runs/:id", async (c) => {
  const userId = c.get("userId");
  const run = getDramaRun(userId, c.req.param("id"));
  if (!run) throw new AppError(404, "NOT_FOUND", "短剧 Run 不存在");
  const projectRow = getDramaProject(userId, run.project_id);
  if (!projectRow) throw new AppError(404, "NOT_FOUND", "短剧项目不存在");
  return c.json({ data: serializeDramaRun(run, projectRow) });
});

drama.post("/runs/:id/confirm", async (c) => {
  const userId = c.get("userId");
  const runId = c.req.param("id");
  const run = getDramaRun(userId, runId);
  if (!run) throw new AppError(404, "NOT_FOUND", "短剧 Run 不存在");
  if (run.status !== "waiting_confirm") {
    throw new AppError(400, "INVALID_STATE", "当前不在待确认状态");
  }
  assertSessionWrite(userId, run.session_id);
  updateDramaRun(runId, { status: "queued" });
  updateDramaProject(run.project_id, { status: "producing" });
  dispatchDramaRun(runId, userId);
  const projectRow = getDramaProject(userId, run.project_id)!;
  const next = getDramaRun(userId, runId)!;
  return c.json({ data: serializeDramaRun(next, projectRow) });
});

drama.post("/runs/:id/cancel", async (c) => {
  const userId = c.get("userId");
  const runId = c.req.param("id");
  const run = getDramaRun(userId, runId);
  if (!run) throw new AppError(404, "NOT_FOUND", "短剧 Run 不存在");
  updateDramaRun(runId, {
    status: "cancelled",
    error: "用户取消",
    pendingJobId: null,
  });
  const projectRow = getDramaProject(userId, run.project_id)!;
  const next = getDramaRun(userId, runId)!;
  return c.json({ data: serializeDramaRun(next, projectRow) });
});

drama.post("/runs/:id/shots/:shotId/retry", async (c) => {
  const userId = c.get("userId");
  const runId = c.req.param("id");
  const shotId = c.req.param("shotId");
  const body = z
    .object({ stage: z.enum(["keyframe", "video"]).default("keyframe") })
    .parse(await c.req.json());
  const next = await retryDramaShot(userId, runId, shotId, body.stage);
  if (!next) throw new AppError(404, "NOT_FOUND", "短剧 Run 不存在");
  const projectRow = getDramaProject(userId, next.project_id)!;
  return c.json({ data: serializeDramaRun(next, projectRow) });
});

drama.get("/estimate", async (c) => {
  const shotCount = Number(c.req.query("shotCount") ?? "10");
  const charCount = Number(c.req.query("charCount") ?? "2");
  const sceneCount = Number(c.req.query("sceneCount") ?? "2");
  const mockProject = {
    userIdea: "",
    targetDurationSec: 90,
    script: { title: "", logline: "", acts: [], narratorLines: [] },
    styleBible: {
      palette: ["a"],
      lightingStyle: "",
      aspectRatio: "9:16" as const,
      negativePrompt: "",
    },
    characters: Array.from({ length: charCount }, (_, i) => ({
      id: `c${i}`,
      name: `角色${i}`,
      personalityTone: "",
      visualSignature: {
        ageRange: "",
        faceShape: "",
        eyeShape: "",
        hairStyle: "",
        skinTone: "",
        signatureOutfit: "",
        distinguishingFeatures: [],
      },
      promptAnchor: "",
    })),
    scenes: Array.from({ length: sceneCount }, (_, i) => ({
      id: `s${i}`,
      name: "",
      location: "",
      atmosphere: "",
      promptAnchor: "",
      props: [],
    })),
    shots: Array.from({ length: shotCount }, (_, i) => ({
      id: `shot${i}`,
      order: i,
      sceneId: "s0",
      characterIds: ["c0"],
      dialogue: i % 2 === 0 ? [{ characterId: "c0", line: "对白" }] : [],
      visualPrompt: "",
      motionPrompt: "",
      cameraSpec: { shotSize: "MS", movement: "固定", lighting: "" },
      durationSec: 5,
      useLastFrameContinuity: false,
      status: "pending" as const,
    })),
  };
  return c.json({ data: { estimatedPoints: estimateDramaPoints(mockProject) } });
});

export { drama };
