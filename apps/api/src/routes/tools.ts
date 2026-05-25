import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../middleware/auth.js";
import { createGenerationJob } from "../lib/jobs.js";
import { getTool, STUDIO_TOOLS } from "../lib/tools.js";
import { suggestModel } from "../lib/router.js";
import {
  enrichPromptWithReferences,
  resolveReferenceUrls,
} from "../lib/references.js";
import { AppError } from "../lib/errors.js";

const tools = new Hono<{ Variables: AuthVariables }>();

tools.get("/list", (c) => c.json({ data: STUDIO_TOOLS }));

tools.post("/:toolId/run", async (c) => {
  const userId = c.get("userId");
  const toolId = c.req.param("toolId");
  const tool = getTool(toolId);
  if (!tool) throw new AppError(404, "NOT_FOUND", "工具不存在");

  const body = z
    .object({
      sessionId: z.string().uuid(),
      prompt: z.string().optional(),
      modelId: z.string().optional(),
      resolution: z.enum(["1k", "2k", "4k"]).default("1k"),
      referenceOutputIds: z.array(z.string().uuid()).optional(),
      assetIds: z.array(z.string().uuid()).optional(),
    })
    .parse(await c.req.json());

  let prompt = body.prompt?.trim() || tool.defaultPrompt;
  const refUrls = body.referenceOutputIds
    ? resolveReferenceUrls(body.referenceOutputIds)
    : [];
  prompt = enrichPromptWithReferences(prompt, refUrls);

  const route = suggestModel("chat", prompt);
  const modelId = body.modelId ?? route.modelId;

  const { jobId, pointsCost } = createGenerationJob({
    sessionId: body.sessionId,
    userId,
    prompt: `【${tool.name}】${prompt}`,
    modelId,
    mode: "chat",
    count: 1,
    resolution: body.resolution,
    toolType: toolId,
  });

  return c.json({
    data: {
      jobId,
      estimatedPoints: pointsCost,
      tool: tool.name,
      routeReason: route.reason,
    },
  });
});

export { tools };
