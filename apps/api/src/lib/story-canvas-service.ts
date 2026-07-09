import { z } from "zod";
import { db } from "../db/index.js";
import { createGenerationJob, getJob } from "./jobs.js";
import { AppError } from "./errors.js";
import { assertSessionWrite } from "./session-access.js";
import { toPublicAssetUrl } from "./public-url.js";

export type WorkflowJobContext = {
  workflowNodeKey: string;
  workflowToolType?: string;
};

export function parseWorkflowJobContext(
  raw: string | null | undefined,
): WorkflowJobContext | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WorkflowJobContext;
    if (parsed.workflowNodeKey) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function findLatestJobByNodeKey(
  sessionId: string,
  nodeKey: string,
): { id: string; status: string } | null {
  const rows = db
    .prepare(
      `SELECT id, status, tool_context, created_at FROM generation_jobs
       WHERE session_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 50`,
    )
    .all(sessionId) as {
    id: string;
    status: string;
    tool_context: string | null;
  }[];

  for (const row of rows) {
    const ctx = parseWorkflowJobContext(row.tool_context);
    if (ctx?.workflowNodeKey === nodeKey) return { id: row.id, status: row.status };
  }
  return null;
}

const generateImageBody = z.object({
  sessionId: z.string().uuid(),
  nodeKey: z.string().min(1).max(200),
  prompt: z.string().min(1).max(4000),
  workflowToolType: z.string().optional(),
  referenceUrls: z.array(z.string()).max(12).optional(),
  modelId: z.string().optional(),
  count: z.number().int().min(1).max(4).optional(),
  resolution: z.string().optional(),
  aspectRatio: z.string().optional(),
});

const generateVideoBody = z.object({
  sessionId: z.string().uuid(),
  nodeKey: z.string().min(1).max(200),
  prompt: z.string().min(1).max(4000),
  workflowToolType: z.string().optional(),
  referenceUrls: z.array(z.string()).max(6).optional(),
  modelId: z.string().optional(),
  resolution: z.string().optional(),
  aspectRatio: z.string().optional(),
});

const batchStatusQuery = z.object({
  sessionId: z.string().uuid(),
  nodeKeys: z.string().min(1),
});

export function runWorkflowImageGeneration(
  userId: string,
  body: z.infer<typeof generateImageBody>,
) {
  assertSessionWrite(userId, body.sessionId);
  const modelId = body.modelId ?? process.env.DEFAULT_IMAGE_MODEL ?? "seedream-4-5-251128";
  const { jobId, pointsCost } = createGenerationJob({
    sessionId: body.sessionId,
    userId,
    prompt: body.prompt,
    modelId,
    mode: "image",
    count: body.count ?? 1,
    resolution: body.resolution ?? "1k",
    aspectRatio: body.aspectRatio ?? "1:1",
    referenceUrls: body.referenceUrls,
    sourceLane: "image",
    toolContext: {
      workflowNodeKey: body.nodeKey,
      workflowToolType: body.workflowToolType,
    },
  });
  return { nodeKey: body.nodeKey, jobId, status: "pending" as const, pointsCost };
}

export function runWorkflowVideoGeneration(
  userId: string,
  body: z.infer<typeof generateVideoBody>,
) {
  assertSessionWrite(userId, body.sessionId);
  const modelId = body.modelId ?? process.env.DEFAULT_VIDEO_MODEL ?? "wan2.6-t2v";
  const { jobId, pointsCost } = createGenerationJob({
    sessionId: body.sessionId,
    userId,
    prompt: body.prompt,
    modelId,
    mode: "video",
    count: 1,
    resolution: body.resolution ?? "720p",
    aspectRatio: body.aspectRatio ?? "16:9",
    referenceUrls: body.referenceUrls,
    sourceLane: "video",
    toolContext: {
      workflowNodeKey: body.nodeKey,
      workflowToolType: body.workflowToolType,
    },
  });
  return { nodeKey: body.nodeKey, jobId, status: "pending" as const, pointsCost };
}

export function batchQueryWorkflowStatus(
  userId: string,
  sessionId: string,
  nodeKeys: string[],
) {
  assertSessionWrite(userId, sessionId);
  const result: Record<
    string,
    { status: string; jobId?: string; outputUrl?: string; error?: string }
  > = {};

  for (const nodeKey of nodeKeys) {
    const latest = findLatestJobByNodeKey(sessionId, nodeKey);
    if (!latest) {
      result[nodeKey] = { status: "idle" };
      continue;
    }
    const job = getJob(latest.id, userId);
    const outputUrl = job.outputs[0]?.url
      ? toPublicAssetUrl(job.outputs[0].url)
      : undefined;
    result[nodeKey] = {
      status: String(job.status),
      jobId: latest.id,
      outputUrl,
      error: job.error != null ? String(job.error) : undefined,
    };
  }

  return result;
}

export const storyCanvasSchemas = {
  generateImageBody,
  generateVideoBody,
  batchStatusQuery,
};
