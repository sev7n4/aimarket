import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { AppError } from "./errors.js";
import { resolveLocalMediaPath } from "./media-path.js";
import { saveUpload } from "./storage.js";
import { ffmpegAvailable } from "./video-poster.js";

const execFileAsync = promisify(execFile);

/** 使用 FFmpeg 将 BGM 混入视频（保留原画面，替换/叠加音轨） */
export async function muxVideoWithBgm(
  videoUrl: string,
  audioUrl: string,
): Promise<{ url: string; sizeBytes: number; mimeType: string }> {
  if (!(await ffmpegAvailable())) {
    throw new AppError(
      503,
      "FFMPEG_UNAVAILABLE",
      "服务器未安装 FFmpeg，暂无法合成 BGM",
    );
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "aimarket-bgm-"));
  const video = await resolveLocalMediaPath(videoUrl);
  const audio = await resolveLocalMediaPath(audioUrl);
  const outPath = path.join(workDir, `${randomUUID()}.mp4`);

  try {
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        video.filePath,
        "-i",
        audio.filePath,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        outPath,
      ],
      { timeout: 300_000 },
    );

    const buffer = await fs.readFile(outPath);
    const saved = await saveUpload(
      buffer,
      "video/mp4",
      `bgm-mux-${randomUUID()}.mp4`,
      { lane: "video" },
    );
    return {
      url: saved.url,
      sizeBytes: saved.sizeBytes,
      mimeType: "video/mp4",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new AppError(
      500,
      "BGM_MUX_FAILED",
      `BGM 合成失败：${msg.slice(0, 200)}`,
    );
  } finally {
    await video.cleanup();
    await audio.cleanup();
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
