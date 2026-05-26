import { Hono } from "hono";
import type { AuthVariables } from "../middleware/auth.js";
import { getJob } from "../lib/jobs.js";
import { AppError } from "../lib/errors.js";

const imageTask = new Hono<{ Variables: AuthVariables }>();

/** 椒图兼容：GET /imageTask/taskStatus?taskId= */
imageTask.get("/taskStatus", (c) => {
  const userId = c.get("userId");
  const taskId = c.req.query("taskId");
  if (!taskId) {
    throw new AppError(400, "VALIDATION_ERROR", "缺少 taskId");
  }

  const job = getJob(taskId, userId);

  const statusMap: Record<string, string> = {
    queued: "processing",
    running: "processing",
    succeeded: "success",
    failed: "fail",
  };

  return c.json({
    data: {
      taskId: job.id,
      status: statusMap[job.status] ?? job.status,
      error: job.error,
      images: job.outputs?.map((o) => ({ url: o.url })) ?? [],
      outputs: job.outputs,
      outputType: job.outputType,
    },
  });
});

export { imageTask };
