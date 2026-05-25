import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../middleware/auth.js";
import { buildEcommercePrompt, ECOMMERCE_SLIDES } from "../lib/ecommerce.js";
import { createGenerationJob } from "../lib/jobs.js";
import { suggestModel } from "../lib/router.js";
import { enrichPromptWithReferences } from "../lib/references.js";
import { db } from "../db/index.js";
import { AppError } from "../lib/errors.js";
import { assertPromptAllowed } from "../lib/content-moderation.js";
import { rateLimit } from "../lib/rate-limit.js";

export const productSetPublic = new Hono();

productSetPublic.get("/init", (c) =>
  c.json({
    data: {
      platforms: ["淘宝", "京东", "抖音", "Amazon"],
      markets: ["中国", "美国", "东南亚"],
      languages: ["中文", "English"],
      designers: ["Gloria", "Alex", "Mia"],
      slides: ECOMMERCE_SLIDES,
    },
  }),
);

export const productSetAuthed = new Hono<{ Variables: AuthVariables }>();

productSetAuthed.get("/models", (c) =>
  c.json({
    data: [
      { id: "latest-v2-pro", name: "最新图片 V2 Pro" },
      { id: "omni-v2", name: "全能图片 V2" },
    ],
  }),
);

productSetAuthed.post("/generate", async (c) => {
  const userId = c.get("userId");
  rateLimit(`ecommerce:${userId}`, 15, 60_000);
  const body = z
    .object({
      sessionId: z.string().uuid(),
      brand: z.string().optional(),
      platform: z.string().default("淘宝"),
      market: z.string().default("中国"),
      language: z.string().default("中文"),
      productInfo: z.string().min(10),
      designer: z.string().optional(),
      modelId: z.string().optional(),
      resolution: z.enum(["1k", "2k", "4k"]).default("2k"),
      productAssetId: z.string().uuid().optional(),
      referenceAssetId: z.string().uuid().optional(),
    })
    .parse(await c.req.json());

  const session = db
    .prepare("SELECT id FROM image_sessions WHERE id = ? AND user_id = ?")
    .get(body.sessionId, userId);
  if (!session) throw new AppError(404, "NOT_FOUND", "会话不存在");

  assertPromptAllowed(body.productInfo);

  let prompt = buildEcommercePrompt({
    brand: body.brand,
    platform: body.platform,
    market: body.market,
    language: body.language,
    productInfo: body.productInfo,
    designer: body.designer,
    productAssetId: body.productAssetId,
    referenceAssetId: body.referenceAssetId,
  });

  const assetUrls: string[] = [];
  for (const assetId of [body.productAssetId, body.referenceAssetId]) {
    if (!assetId) continue;
    const asset = db
      .prepare("SELECT url FROM assets WHERE id = ? AND user_id = ?")
      .get(assetId, userId) as { url: string } | undefined;
    if (asset) assetUrls.push(asset.url);
  }
  if (assetUrls.length) {
    prompt = enrichPromptWithReferences(prompt, assetUrls);
  }

  const route = suggestModel("ecommerce", prompt);
  const modelId = body.modelId ?? route.modelId;
  const count = ECOMMERCE_SLIDES.length;

  const { jobId, pointsCost } = createGenerationJob({
    sessionId: body.sessionId,
    userId,
    prompt,
    modelId,
    mode: "ecommerce",
    count,
    resolution: body.resolution,
    toolType: "ecommerce-set",
    slideLabels: ECOMMERCE_SLIDES.map((s) => s.label),
  });

  return c.json({
    data: {
      jobId,
      estimatedPoints: pointsCost,
      modelId,
      routeReason: route.reason,
      slideCount: count,
    },
  });
});
