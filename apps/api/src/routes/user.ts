import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/index.js";
import type { AuthVariables } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import {
  getUserProviderConfigPublic,
  saveUserProviderConfig,
} from "../lib/user-provider-config.js";

const user = new Hono<{ Variables: AuthVariables }>();

user.get("/getInfo", (c) => {
  const userId = c.get("userId");
  const row = db
    .prepare("SELECT id, email, credits, created_at FROM users WHERE id = ?")
    .get(userId);
  if (!row) throw new AppError(404, "NOT_FOUND", "用户不存在");
  return c.json({ data: row });
});

user.get("/queryPoints", (c) => {
  const userId = c.get("userId");
  const row = db
    .prepare("SELECT credits FROM users WHERE id = ?")
    .get(userId) as { credits: number } | undefined;
  if (!row) throw new AppError(404, "NOT_FOUND", "用户不存在");
  return c.json({ data: { credits: row.credits } });
});

/** 用户模型接入配置（BYOK，加密存储） */
user.get("/providerConfig", (c) => {
  const userId = c.get("userId");
  const config = getUserProviderConfigPublic(userId);
  const serverOpenaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  return c.json({
    data: {
      ...config,
      server: {
        openaiConfigured: serverOpenaiConfigured,
        imageProviderMode: process.env.IMAGE_PROVIDER ?? "auto",
      },
    },
  });
});

user.put("/providerConfig", async (c) => {
  const userId = c.get("userId");
  const body = z
    .object({
      useByok: z.boolean().optional(),
      openai: z
        .object({
          apiKey: z.string().max(512).nullable().optional(),
          baseUrl: z.string().max(500).nullable().optional(),
        })
        .optional(),
    })
    .parse(await c.req.json());

  const data = saveUserProviderConfig(userId, body);
  return c.json({ data });
});

export { user };
