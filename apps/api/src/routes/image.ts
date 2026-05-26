import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../middleware/auth.js";
import {
  mockReversePrompt,
  resolveImageUrlForReverse,
} from "../lib/prompt-reverse.js";

const image = new Hono<{ Variables: AuthVariables }>();

const reverseBodySchema = z.object({
  imageUrl: z.string().max(2048).optional(),
  assetId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
});

async function handlePromptReverse(
  c: { get: (k: "userId") => string },
  body: z.infer<typeof reverseBodySchema>,
) {
  const userId = c.get("userId");
  const imageUrl = resolveImageUrlForReverse({
    imageUrl: body.imageUrl,
    assetId: body.assetId,
    userId,
  });
  const prompt = mockReversePrompt(imageUrl);
  return {
    prompt,
    imageUrl,
    source: "mock" as const,
  };
}

/** Canonical：图生文（mock，P4 可换 LLM） */
image.post("/prompt-reverse", async (c) => {
  const body = reverseBodySchema.parse(await c.req.json());
  const data = await handlePromptReverse(c, body);
  return c.json({ data });
});

/** 椒图别名（与 canonical 同响应） */
image.post("/originalImagePromptReverse", async (c) => {
  const body = reverseBodySchema.parse(await c.req.json());
  const data = await handlePromptReverse(c, body);
  return c.json({ data });
});

image.post("/templateSummaryPromptReverse", async (c) => {
  const body = reverseBodySchema.parse(await c.req.json());
  const data = await handlePromptReverse(c, body);
  return c.json({ data });
});

export { image };
