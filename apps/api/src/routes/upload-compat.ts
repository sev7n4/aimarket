import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../middleware/auth.js";
import {
  confirmAssetUpload,
  createUploadIntent,
} from "../lib/asset-upload.js";

/** 椒图别名：/upload/token、/upload/callback（需 COMPAT_JIAOTU_ALIASES=true） */
export const uploadCompat = new Hono<{ Variables: AuthVariables }>();

uploadCompat.post("/token", async (c) => {
  const userId = c.get("userId");
  const body = z
    .object({
      fileName: z.string().min(1).max(255),
      mimeType: z.string(),
      sizeBytes: z.number().int().positive(),
      sessionId: z.string().uuid().optional(),
    })
    .parse(await c.req.json());

  const intent = await createUploadIntent(userId, body);

  return c.json({
    data: {
      uploadUrl: intent.uploadUrl,
      ossId: intent.assetId,
      headers: intent.headers,
      expireAt: intent.expireAt,
      method: intent.method,
      fields: intent.fields,
    },
  });
});

uploadCompat.post("/callback", async (c) => {
  const userId = c.get("userId");
  const body = z
    .object({
      ossId: z.string().uuid(),
    })
    .parse(await c.req.json());

  const asset = await confirmAssetUpload(userId, body.ossId);

  return c.json({
    data: {
      ossId: asset.id,
      url: asset.url,
    },
  });
});
