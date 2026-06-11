import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db/index.js";
import { AppError } from "../lib/errors.js";
import { assertSessionWrite } from "../lib/session-access.js";
import { muxVideoWithBgm } from "../lib/video-bgm-mux.js";
import { toPublicAssetUrl } from "../lib/public-url.js";
import type { AuthVariables } from "../middleware/auth.js";

export const video = new Hono<{ Variables: AuthVariables }>();

video.post("/mux-bgm", async (c) => {
  const userId = c.get("userId");
  const body = z
    .object({
      sessionId: z.string().uuid(),
      videoUrl: z.string().url().max(2000),
      audioAssetId: z.string().uuid(),
    })
    .parse(await c.req.json());

  assertSessionWrite(userId, body.sessionId);

  const audio = db
    .prepare("SELECT id, url, mime_type FROM assets WHERE id = ? AND user_id = ?")
    .get(body.audioAssetId, userId) as
    | { id: string; url: string; mime_type: string }
    | undefined;

  if (!audio) {
    throw new AppError(404, "NOT_FOUND", "音频素材不存在");
  }
  if (!audio.mime_type.startsWith("audio/")) {
    throw new AppError(400, "INVALID_AUDIO", "请选择音频文件作为 BGM");
  }

  const muxed = await muxVideoWithBgm(
    body.videoUrl,
    toPublicAssetUrl(audio.url),
  );

  const outputAssetId = randomUUID();
  db.prepare(
    `INSERT INTO assets (id, user_id, session_id, filename, url, mime_type, size_bytes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    outputAssetId,
    userId,
    body.sessionId,
    `bgm-mux-${outputAssetId.slice(0, 8)}.mp4`,
    muxed.url,
    muxed.mimeType,
    muxed.sizeBytes,
  );

  return c.json({
    data: {
      jobId: outputAssetId,
      assetId: outputAssetId,
      outputUrl: muxed.url,
    },
  });
});
