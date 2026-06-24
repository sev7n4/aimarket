import { Hono } from "hono";
import { z } from "zod";
import { streamSSE } from "hono/streaming";
import type { AuthVariables } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { assertSessionWrite } from "../lib/session-access.js";
import { planDramaProject } from "../lib/drama/planner.js";
import {
  createDramaProject,
  getDramaProject,
  parseProjectJson,
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
  pickDramaKeyframeHero,
  rerunDramaRunFromNode,
  retryDramaRun,
  retryDramaShot,
} from "../lib/drama/executor.js";
import { DRAMA_PIPELINE_STEPS } from "../lib/drama/schema.js";
import { estimateDramaPoints } from "../lib/drama/estimate.js";
import { assertDramaCreditsAffordable } from "../lib/drama/credits-gate.js";
import { dispatchDramaPlanRun, dispatchDramaPlanRerun, prepareDramaPlanRerun } from "../lib/drama/plan-executor.js";
import {
  getPlanEventBuffer,
  isTerminalPlanEvent,
  subscribePlanEvents,
} from "../lib/drama/plan-events.js";
import {
  getRunEventBuffer,
  isTerminalRunEvent,
  subscribeRunEvents,
} from "../lib/drama/run-events.js";
import type { DramaRunStreamEvent } from "../lib/drama/run-events.js";
import {
  createDramaPlanRun,
  getDramaPlanRun,
  serializeDramaPlanRun,
} from "../lib/drama/plan-runs.js";
import { mergeDramaProjectPatch } from "../lib/drama/merge-patch.js";
import {
  analyzeReferenceVideo,
  formatReplicateProfileForPlanner,
  replicateProfileSchema,
} from "../lib/drama/replicate.js";
import {
  assertAllCharactersLockedForProduce,
  dispatchCharacterTurnaround,
} from "../lib/drama/character-turnaround.js";
import { serializeDramaSessionState } from "../lib/drama/session-state.js";
import { buildDramaRunGraph } from "../lib/drama/run-graph.js";
import type { DramaPlanAgentId, DramaPlanEvent } from "../lib/drama/planner/types.js";

const drama = new Hono<{ Variables: AuthVariables }>();

const createBody = z.object({
  sessionId: z.string().uuid(),
  userIdea: z.string().min(10).max(2000),
  targetDurationSec: z.number().int().min(60).max(180).optional(),
  aspectRatio: z.enum(["9:16", "16:9"]).optional(),
  planMode: z.enum(["single", "multi_agent"]).optional(),
  confirmed: z.boolean().default(false),
  autoProduce: z.boolean().default(false),
});

/** 规划短剧项目（RHTV：大纲 → 角色资产表 → 分镜） */
drama.post("/runs", async (c) => {
  const userId = c.get("userId");
  const body = createBody.parse(await c.req.json());
  assertSessionWrite(userId, body.sessionId);

  const projectData = await planDramaProject(
    {
      userIdea: body.userIdea,
      targetDurationSec: body.targetDurationSec,
      aspectRatio: body.aspectRatio,
    },
    { planMode: body.planMode },
  );

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
    .object({
      sessionId: z.string().uuid(),
      confirmed: z.coerce.boolean().default(true),
    })
    .parse(await c.req.json());
  assertSessionWrite(userId, body.sessionId);

  const projectRow = getDramaProject(userId, projectId);
  if (!projectRow) {
    throw new AppError(404, "NOT_FOUND", "短剧项目不存在");
  }

  assertAllCharactersLockedForProduce(parseProjectJson(projectRow));

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

drama.post(
  "/projects/:projectId/characters/:characterId/turnaround",
  async (c) => {
    const userId = c.get("userId");
    const projectId = c.req.param("projectId");
    const characterId = c.req.param("characterId");
    const row = getDramaProject(userId, projectId);
    if (!row) throw new AppError(404, "NOT_FOUND", "短剧项目不存在");
    assertSessionWrite(userId, row.session_id);

    const result = dispatchCharacterTurnaround(userId, projectId, characterId);
    const next = getDramaProject(userId, projectId)!;
    return c.json(
      {
        data: {
          ...result,
          project: serializeDramaProject(next),
        },
      },
      202,
    );
  },
);

drama.patch("/projects/:id", async (c) => {
  const userId = c.get("userId");
  const row = getDramaProject(userId, c.req.param("id"));
  if (!row) throw new AppError(404, "NOT_FOUND", "短剧项目不存在");
  const body = z
    .object({ project: z.record(z.unknown()).optional() })
    .parse(await c.req.json());
  if (body.project) {
    const current = JSON.parse(row.project_json);
    const merged = mergeDramaProjectPatch(current, body.project);
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

drama.get("/runs/:id/graph", async (c) => {
  const userId = c.get("userId");
  const run = getDramaRun(userId, c.req.param("id"));
  if (!run) throw new AppError(404, "NOT_FOUND", "短剧 Run 不存在");
  const projectRow = getDramaProject(userId, run.project_id);
  if (!projectRow) throw new AppError(404, "NOT_FOUND", "短剧项目不存在");
  return c.json({ data: buildDramaRunGraph(run, projectRow) });
});

drama.get("/runs/:id/stream", (c) => {
  const userId = c.get("userId");
  const runId = c.req.param("id");
  const run = getDramaRun(userId, runId);
  if (!run) throw new AppError(404, "NOT_FOUND", "短剧 Run 不存在");

  return streamSSE(c, async (stream) => {
    const writeEvent = async (event: DramaRunStreamEvent) => {
      await stream.writeSSE({
        event: event.type,
        data: JSON.stringify(event),
      });
    };

    const replayed = getRunEventBuffer(runId);
    for (const event of replayed) {
      await writeEvent(event);
    }
    if (replayed.some(isTerminalRunEvent)) return;

    const deadline =
      Date.now() + Number(process.env.DRAMA_RUN_STREAM_MAX_MS ?? 3_600_000);

    await new Promise<void>((resolve) => {
      let cursor = replayed.length;

      const flushNew = async () => {
        const buf = getRunEventBuffer(runId);
        while (cursor < buf.length) {
          const event = buf[cursor]!;
          cursor += 1;
          await writeEvent(event);
          if (isTerminalRunEvent(event)) {
            cleanup();
            resolve();
            return;
          }
        }
      };

      const cleanup = subscribeRunEvents(runId, () => {
        void flushNew();
      });

      const poll = setInterval(() => {
        void flushNew();
        const latest = getDramaRun(userId, runId);
        if (
          latest &&
          (latest.status === "completed" ||
            latest.status === "failed" ||
            latest.status === "cancelled")
        ) {
          clearInterval(poll);
          cleanup();
          resolve();
        }
        if (Date.now() > deadline) {
          clearInterval(poll);
          cleanup();
          resolve();
        }
      }, 800);

      void flushNew();
    });
  });
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
  assertDramaCreditsAffordable(userId, run.estimated_points);
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

drama.post("/runs/:id/retry", async (c) => {
  const userId = c.get("userId");
  const runId = c.req.param("id");
  const body = z
    .object({
      fromStep: z.enum(DRAMA_PIPELINE_STEPS as [string, ...string[]]).optional(),
    })
    .parse(await c.req.json().catch(() => ({})));
  const run = getDramaRun(userId, runId);
  if (!run) throw new AppError(404, "NOT_FOUND", "短剧 Run 不存在");
  if (run.status !== "failed") {
    throw new AppError(400, "INVALID_STATE", "仅失败状态可重试制作");
  }
  assertSessionWrite(userId, run.session_id);
  try {
    const next = await retryDramaRun(
      userId,
      runId,
      body.fromStep as (typeof DRAMA_PIPELINE_STEPS)[number] | undefined,
    );
    if (!next) throw new AppError(404, "NOT_FOUND", "短剧 Run 不存在");
    const projectRow = getDramaProject(userId, next.project_id)!;
    return c.json({ data: serializeDramaRun(next, projectRow) });
  } catch (err) {
    if (err instanceof Error && err.message === "DRAMA_RUN_NOT_FAILED") {
      throw new AppError(400, "INVALID_STATE", "仅失败状态可重试制作");
    }
    throw err;
  }
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

drama.post("/runs/:id/nodes/:nodeId/rerun", async (c) => {
  const userId = c.get("userId");
  const runId = c.req.param("id");
  const nodeId = c.req.param("nodeId");
  if (!(DRAMA_PIPELINE_STEPS as readonly string[]).includes(nodeId)) {
    throw new AppError(400, "VALIDATION_ERROR", "无效的节点 ID");
  }
  const body = z
    .object({ projectPatch: z.record(z.unknown()).optional() })
    .parse(await c.req.json().catch(() => ({})));
  const run = getDramaRun(userId, runId);
  if (!run) throw new AppError(404, "NOT_FOUND", "短剧 Run 不存在");
  assertSessionWrite(userId, run.session_id);
  try {
    const next = await rerunDramaRunFromNode(
      userId,
      runId,
      nodeId as (typeof DRAMA_PIPELINE_STEPS)[number],
      body.projectPatch,
    );
    if (!next) throw new AppError(404, "NOT_FOUND", "短剧 Run 不存在");
    const projectRow = getDramaProject(userId, next.project_id)!;
    return c.json({ data: serializeDramaRun(next, projectRow) });
  } catch (err) {
    if (err instanceof Error && err.message === "DRAMA_RUN_NOT_RERUNNABLE") {
      throw new AppError(
        400,
        "INVALID_STATE",
        "仅已完成、失败或已取消的制作可从此节点重跑",
      );
    }
    throw err;
  }
});

drama.post("/runs/:id/shots/:shotId/pick-keyframe", async (c) => {
  const userId = c.get("userId");
  const runId = c.req.param("id");
  const shotId = c.req.param("shotId");
  const body = z
    .object({ heroIndex: z.number().int().min(0) })
    .parse(await c.req.json());
  const row = await pickDramaKeyframeHero(
    userId,
    runId,
    shotId,
    body.heroIndex,
  );
  if (!row) throw new AppError(404, "NOT_FOUND", "短剧 Run 不存在");
  const projectRow = getDramaProject(userId, row.project_id)!;
  const next = getDramaRun(userId, runId)!;
  return c.json({ data: serializeDramaRun(next, projectRow) });
});

drama.get("/estimate", async (c) => {
  const shotCount = Number(c.req.query("shotCount") ?? "10");
  const charCount = Number(c.req.query("charCount") ?? "2");
  const sceneCount = Number(c.req.query("sceneCount") ?? "2");
  const dialogueShots = Number(c.req.query("dialogueShots") ?? String(Math.ceil(shotCount / 2)));
  const previewTier =
    c.req.query("previewTier") === "low" ? ("low" as const) : ("full" as const);
  const mockProject = {
    userIdea: "",
    targetDurationSec: 90,
    script: {
      title: "",
      logline: "",
      acts: [{ act: 1, sceneId: "s0", summary: "预估占位场次" }],
      narratorLines: [],
    },
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
      name: `场景${i}`,
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
      dialogue: i < dialogueShots ? [{ characterId: "c0", line: "对白" }] : [],
      visualPrompt: "",
      motionPrompt: "",
      cameraSpec: { shotSize: "MS", movement: "固定", lighting: "" },
      durationSec: 5,
      useLastFrameContinuity: false,
      status: "pending" as const,
    })),
    productionParams: { previewTier, aspectRatio: "9:16" as const },
  };
  const validated = dramaProjectSchema.parse(mockProject);
  return c.json({ data: { estimatedPoints: estimateDramaPoints(validated) } });
});

/** 按完整项目结构估算积分（草稿编辑后实时预估） */
drama.post("/estimate", async (c) => {
  const body = z
    .object({ project: z.record(z.unknown()) })
    .parse(await c.req.json());
  const validated = dramaProjectSchema.parse(body.project);
  return c.json({ data: { estimatedPoints: estimateDramaPoints(validated) } });
});

const planCreateBody = z.object({
  sessionId: z.string().uuid(),
  userIdea: z.string().min(10).max(2000),
  targetDurationSec: z.number().int().min(60).max(180).optional(),
  aspectRatio: z.enum(["9:16", "16:9"]).optional(),
  autoProduce: z.coerce.boolean().default(false),
  replicateProfile: replicateProfileSchema.optional(),
  projectType: z.enum(["short_drama", "mv", "creative"]).default("short_drama"),
});

drama.post("/replicate/analyze", async (c) => {
  const body = z
    .object({ videoUrl: z.string().url() })
    .parse(await c.req.json());
  const profile = await analyzeReferenceVideo(body.videoUrl);
  return c.json({ data: profile });
});

/** 异步多 Agent 规划（SSE 进度） */
drama.post("/plan/runs", async (c) => {
  const userId = c.get("userId");
  const body = planCreateBody.parse(await c.req.json());
  assertSessionWrite(userId, body.sessionId);

  const userIdea = body.replicateProfile
    ? `${body.userIdea.trim()}\n\n${formatReplicateProfileForPlanner(body.replicateProfile)}`
    : body.userIdea;

  const row = createDramaPlanRun({
    sessionId: body.sessionId,
    userId,
    userIdea,
    targetDurationSec:
      body.replicateProfile?.suggestedDurationSec ?? body.targetDurationSec,
    aspectRatio: body.aspectRatio,
    autoProduce: body.autoProduce,
    projectType: body.projectType,
  });
  dispatchDramaPlanRun(row.id, userId);

  return c.json({ data: serializeDramaPlanRun(row) }, 201);
});

drama.post("/plan/runs/:id/rerun", async (c) => {
  const userId = c.get("userId");
  const runId = c.req.param("id");
  const body = z
    .object({
      fromAgent: z.enum([
        "writer",
        "director",
        "character",
        "cinematographer",
        "storyboard",
      ]),
      projectPatch: z.record(z.unknown()).optional(),
    })
    .parse(await c.req.json());

  const row = getDramaPlanRun(userId, runId);
  if (!row) throw new AppError(404, "NOT_FOUND", "规划 Run 不存在");
  if (!row.project_id) {
    throw new AppError(400, "INVALID_STATE", "规划尚未完成，无法重跑");
  }
  if (row.status === "planning") {
    throw new AppError(400, "INVALID_STATE", "规划进行中，请稍后再试");
  }

  assertSessionWrite(userId, row.session_id);
  if (
    !prepareDramaPlanRerun(
      runId,
      userId,
      body.fromAgent as DramaPlanAgentId,
      body.projectPatch,
    )
  ) {
    throw new AppError(400, "INVALID_STATE", "无法重跑规划");
  }
  dispatchDramaPlanRerun(runId, userId, body.fromAgent as DramaPlanAgentId);

  const next = getDramaPlanRun(userId, runId)!;
  return c.json({ data: serializeDramaPlanRun(next) });
});

/** 会话短剧状态（刷新 Studio 时恢复规划/制作态） */
drama.get("/sessions/:sessionId/state", async (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");
  assertSessionWrite(userId, sessionId);
  return c.json({ data: serializeDramaSessionState(userId, sessionId) });
});

drama.get("/plan/runs/:id", async (c) => {
  const userId = c.get("userId");
  const row = getDramaPlanRun(userId, c.req.param("id"));
  if (!row) throw new AppError(404, "NOT_FOUND", "规划 Run 不存在");
  return c.json({ data: serializeDramaPlanRun(row) });
});

drama.get("/plan/runs/:id/stream", (c) => {
  const userId = c.get("userId");
  const runId = c.req.param("id");
  const row = getDramaPlanRun(userId, runId);
  if (!row) throw new AppError(404, "NOT_FOUND", "规划 Run 不存在");

  return streamSSE(c, async (stream) => {
    const writeEvent = async (event: DramaPlanEvent) => {
      await stream.writeSSE({
        event: event.type,
        data: JSON.stringify(event),
      });
    };

    const replayed = getPlanEventBuffer(runId);
    for (const event of replayed) {
      await writeEvent(event);
    }
    if (replayed.some(isTerminalPlanEvent)) return;

    const deadline = Date.now() + Number(process.env.DRAMA_PLAN_STREAM_MAX_MS ?? 600_000);

    await new Promise<void>((resolve) => {
      let cursor = replayed.length;

      const flushNew = async () => {
        const buf = getPlanEventBuffer(runId);
        while (cursor < buf.length) {
          const event = buf[cursor]!;
          cursor += 1;
          await writeEvent(event);
          if (isTerminalPlanEvent(event)) {
            cleanup();
            resolve();
            return;
          }
        }
      };

      const cleanup = subscribePlanEvents(runId, () => {
        void flushNew();
      });

      const poll = setInterval(() => {
        void flushNew();
        const latest = getDramaPlanRun(userId, runId);
        if (
          latest &&
          (latest.status === "completed" || latest.status === "failed")
        ) {
          clearInterval(poll);
          cleanup();
          resolve();
        }
        if (Date.now() > deadline) {
          clearInterval(poll);
          cleanup();
          resolve();
        }
      }, 800);

      void flushNew();
    });
  });
});

export { drama };
