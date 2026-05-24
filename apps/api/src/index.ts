import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";

const app = new Hono();

const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";

app.use(
  "*",
  cors({
    origin: corsOrigin,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.get("/health", (c) =>
  c.json({ ok: true, service: "aimarket-api", version: "0.1.0" }),
);

const imageModels = [
  {
    id: "omni-v2",
    name: "全能图片 V2",
    description: "顶尖图像生成模型，极致速度和超高性价比",
    type: "image",
  },
  {
    id: "latest-v2-pro",
    name: "最新图片 V2 Pro",
    description: "更稳定更快速，擅长复杂电商场景",
    type: "image",
  },
  {
    id: "seedream-5",
    name: "Seedream 5.0",
    description: "多角色超强一致性，中文处理能力极强",
    type: "image",
  },
] as const;

app.get("/api/v1/ai/queryModels", (c) => c.json({ data: imageModels }));

app.post("/api/v1/ai/estimatePointsBatch", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = z
    .object({
      modelId: z.string().optional(),
      count: z.number().int().positive().default(1),
      resolution: z.string().optional(),
    })
    .safeParse(body);

  const count = parsed.success ? parsed.data.count : 1;
  const points = count * 10;

  return c.json({
    data: { estimatedPoints: points, currency: "credits" },
  });
});

app.get("/api/v1/imageSession/queryImageSessionRequestMode", (c) => {
  const sessionId = c.req.query("sessionId");
  if (!sessionId) {
    return c.json({ error: "sessionId required" }, 400);
  }
  return c.json({
    data: {
      sessionId,
      mode: "chat",
      status: "idle",
    },
  });
});

app.get("/api/v1/productSet/init", (c) =>
  c.json({
    data: {
      platforms: ["淘宝", "京东", "抖音", "Amazon"],
      markets: ["中国", "美国", "东南亚"],
      languages: ["中文", "English"],
      designers: ["Gloria", "Alex", "Mia"],
    },
  }),
);

const port = Number(process.env.PORT ?? 4000);

serve({ fetch: app.fetch, port }, () => {
  console.log(`AIMarket API listening on http://localhost:${port}`);
});
