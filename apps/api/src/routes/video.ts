import { Hono } from "hono";
import { z } from "zod";
import { AppError } from "../lib/errors.js";

export const video = new Hono();

/** BGM 混入占位：待 FFmpeg 服务端管线接入后实现 */
video.post("/mux-bgm", async (c) => {
  z.object({
    sessionId: z.string().uuid(),
    videoUrl: z.string().url().max(2000),
    audioAssetId: z.string().uuid(),
  }).parse(await c.req.json());

  throw new AppError(
    501,
    "VIDEO_BGM_NOT_READY",
    "BGM 合成功能即将上线，当前请下载视频后在外部工具配乐",
  );
});
