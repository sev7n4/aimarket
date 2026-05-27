import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../middleware/auth.js";
import {
  buildEcommercePrompt,
  ECOMMERCE_SLIDE_KEYS,
  ECOMMERCE_SLIDES,
  getEcommerceSlideLabel,
  type EcommerceSlideKey,
} from "../lib/ecommerce.js";
import { createGenerationJob } from "../lib/jobs.js";
import { suggestModel } from "../lib/router.js";
import { enrichPromptWithReferences } from "../lib/references.js";
import { db } from "../db/index.js";
import { AppError } from "../lib/errors.js";
import { assertPromptAllowed } from "../lib/content-moderation.js";
import { assertSessionWrite } from "../lib/session-access.js";
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

const ecommerceGenerateBodySchema = z.object({
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
});

function resolveAssetUrls(
  userId: string,
  productAssetId?: string,
  referenceAssetId?: string,
) {
  const urls: string[] = [];
  for (const assetId of [productAssetId, referenceAssetId]) {
    if (!assetId) continue;
    const asset = db
      .prepare("SELECT url FROM assets WHERE id = ? AND user_id = ?")
      .get(assetId, userId) as { url: string } | undefined;
    if (asset) urls.push(asset.url);
  }
  return urls;
}

function buildPromptWithReferences(
  userId: string,
  body: z.infer<typeof ecommerceGenerateBodySchema>,
) {
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
  const assetUrls = resolveAssetUrls(
    userId,
    body.productAssetId,
    body.referenceAssetId,
  );
  if (assetUrls.length) {
    prompt = enrichPromptWithReferences(prompt, assetUrls);
  }
  return prompt;
}

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
  await rateLimit(`ecommerce:${userId}`, 15, 60_000);
  const body = ecommerceGenerateBodySchema.parse(await c.req.json());

  assertSessionWrite(userId, body.sessionId);

  await assertPromptAllowed(body.productInfo);

  const prompt = buildPromptWithReferences(userId, body);

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

productSetAuthed.post("/rerun-slide", async (c) => {
  const userId = c.get("userId");
  await rateLimit(`ecommerce:${userId}`, 15, 60_000);
  const body = ecommerceGenerateBodySchema
    .extend({
      slideKey: z.enum(ECOMMERCE_SLIDE_KEYS),
    })
    .parse(await c.req.json());

  assertSessionWrite(userId, body.sessionId);
  await assertPromptAllowed(body.productInfo);

  const prompt = buildPromptWithReferences(userId, body);
  const route = suggestModel("ecommerce", prompt);
  const modelId = body.modelId ?? route.modelId;
  const slideLabel = getEcommerceSlideLabel(body.slideKey as EcommerceSlideKey);

  const { jobId, pointsCost } = createGenerationJob({
    sessionId: body.sessionId,
    userId,
    prompt,
    modelId,
    mode: "ecommerce",
    count: 1,
    resolution: body.resolution,
    toolType: "ecommerce-set",
    slideLabels: [slideLabel],
  });

  return c.json({
    data: {
      jobId,
      estimatedPoints: pointsCost,
      modelId,
      routeReason: route.reason,
      slideKey: body.slideKey,
      slideLabel,
    },
  });
});
