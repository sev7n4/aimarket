import { z } from "zod";
import { assertSessionWrite } from "./session-access.js";
import { assertAllCharactersLockedForProduce } from "./drama/character-turnaround.js";
import { dispatchDramaRun } from "./drama/executor.js";
import { dispatchDramaPlanRun } from "./drama/plan-executor.js";
import {
  createDramaPlanRun,
  serializeDramaPlanRun,
} from "./drama/plan-runs.js";
import {
  getDramaProject,
  parseProjectJson,
  updateDramaProject,
} from "./drama/projects.js";
import { createDramaRun, serializeDramaRun } from "./drama/runs.js";
import { AppError } from "./errors.js";

export const openDramaPlanBodySchema = z.object({
  sessionId: z.string().uuid(),
  userIdea: z.string().min(10).max(2000),
  targetDurationSec: z.number().int().min(60).max(180).optional(),
  aspectRatio: z.enum(["9:16", "16:9"]).optional(),
  autoProduce: z.coerce.boolean().default(false),
  projectType: z.enum(["short_drama", "mv", "creative"]).default("short_drama"),
});

export function startOpenDramaPlan(
  userId: string,
  body: z.infer<typeof openDramaPlanBodySchema>,
) {
  assertSessionWrite(userId, body.sessionId);

  const row = createDramaPlanRun({
    sessionId: body.sessionId,
    userId,
    userIdea: body.userIdea,
    targetDurationSec: body.targetDurationSec,
    aspectRatio: body.aspectRatio,
    autoProduce: body.autoProduce,
    projectType: body.projectType,
  });
  dispatchDramaPlanRun(row.id, userId);

  return serializeDramaPlanRun(row);
}

export const openDramaProduceBodySchema = z.object({
  sessionId: z.string().uuid(),
  projectId: z.string().uuid(),
  confirmed: z.coerce.boolean().default(true),
});

export function startOpenDramaProduce(
  userId: string,
  body: z.infer<typeof openDramaProduceBodySchema>,
) {
  assertSessionWrite(userId, body.sessionId);

  const projectRow = getDramaProject(userId, body.projectId);
  if (!projectRow) {
    throw new AppError(404, "NOT_FOUND", "短剧项目不存在");
  }
  if (projectRow.session_id !== body.sessionId) {
    throw new AppError(404, "NOT_FOUND", "短剧项目不存在");
  }

  assertAllCharactersLockedForProduce(parseProjectJson(projectRow));
  updateDramaProject(body.projectId, { status: "confirmed" });

  const run = createDramaRun({
    sessionId: body.sessionId,
    userId,
    projectId: body.projectId,
    confirmed: body.confirmed,
  });

  if (run.status !== "waiting_confirm") {
    dispatchDramaRun(run.id, userId);
  }

  return serializeDramaRun(run, projectRow);
}
