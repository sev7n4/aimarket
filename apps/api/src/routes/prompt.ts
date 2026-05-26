import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../middleware/auth.js";
import { optimizePrompt, optimizeModeSchema } from "../lib/prompt-optimize.js";
import { AppError } from "../lib/errors.js";

const prompt = new Hono<{ Variables: AuthVariables }>();

prompt.post("/optimize", async (c) => {
  const body = z
    .object({
      prompt: z.string().max(4000),
      mode: optimizeModeSchema.default("chat"),
    })
    .parse(await c.req.json());

  if (!body.prompt.trim()) {
    throw new AppError(400, "VALIDATION_ERROR", "请输入需要润色的内容");
  }

  return c.json({
    data: {
      prompt: optimizePrompt(body.mode, body.prompt),
    },
  });
});

export { prompt };
